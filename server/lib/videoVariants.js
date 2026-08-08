import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import sharp from 'sharp';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `media process exited ${code}`));
    });
  });
}

async function readMetadata(filePath, ffprobePath) {
  let stdout = '';
  await new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      filePath,
    ], { windowsHide: true });
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffprobe exited ${code}`));
    });
  });

  const data = JSON.parse(stdout);
  const video = data.streams?.find((stream) => stream.codec_type === 'video') || {};
  return {
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    duration: Number(data.format?.duration || 0),
  };
}

export async function createVideoVariants(filePath, options = {}) {
  const encoder = options.ffmpegPath || ffmpegPath;
  const probe = options.ffprobePath || ffprobeStatic.path;
  if (!encoder || !probe) throw new Error('FFmpeg/ffprobe runtime is unavailable');

  const workDir = options.workDir || dirname(filePath);
  const token = randomUUID();
  const video720Path = join(workDir, `${token}--720p.mp4`);
  const posterFramePath = join(workDir, `${token}--poster.jpg`);
  const metadata = await readMetadata(filePath, probe);
  const scale = "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";

  try {
    await run(encoder, [
      '-y', '-loglevel', 'error', '-i', filePath,
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', scale,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-maxrate', '3M', '-bufsize', '6M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-movflags', '+faststart', video720Path,
    ]);

    const seek = Math.min(1, Math.max(0, metadata.duration / 2));
    await run(encoder, [
      '-y', '-loglevel', 'error', '-ss', String(seek), '-i', filePath,
      '-frames:v', '1', '-vf', scale, posterFramePath,
    ]);
    const poster = await sharp(await readFile(posterFramePath)).webp({ quality: 82 }).toBuffer();
    return { video720Path, poster, metadata };
  } catch (error) {
    await rm(video720Path, { force: true });
    throw error;
  } finally {
    await rm(posterFramePath, { force: true });
  }
}
