import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import ffmpegPath from 'ffmpeg-static';
import { createVideoVariants } from './videoVariants.js';

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('video variants', () => {
  it('creates a browser-compatible 720p MP4 and WebP poster', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xingyu-video-'));
    tempDirs.push(dir);
    const inputPath = join(dir, 'input.mp4');
    const { spawn } = await import('node:child_process');
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, [
        '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:d=1',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-shortest', '-c:v', 'libx264', '-c:a', 'aac', inputPath,
      ]);
      child.once('error', reject);
      child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`fixture ffmpeg exited ${code}`))));
    });

    const result = await createVideoVariants(inputPath, { workDir: dir });
    expect(result.metadata).toMatchObject({ width: 1920, height: 1080 });
    expect(result.metadata.duration).toBeGreaterThan(0);
    expect(result.video720Path).toMatch(/\.mp4$/);
    expect((await readFile(result.video720Path)).length).toBeGreaterThan(0);
    expect(result.poster).toBeInstanceOf(Buffer);
    expect(result.poster.length).toBeGreaterThan(0);
  }, 30_000);
});
