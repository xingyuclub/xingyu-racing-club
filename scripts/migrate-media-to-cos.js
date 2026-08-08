import 'dotenv/config';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfigStore } from '../server/lib/configStore.js';
import { createCosStorageFromEnv } from '../server/lib/cosStorage.js';
import { createImageVariant, getMediaKeys } from '../server/lib/mediaVariants.js';
import {
  assertScoreDataUnchanged,
  collectUploadPaths,
  rewriteUploadPaths,
} from '../server/lib/mediaMigration.js';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataDir = join(rootDir, 'server', 'data');
const configPath = join(dataDir, 'site-config.json');
const uploadDir = join(rootDir, 'server', 'storage', 'uploads');
const reportDir = join(rootDir, 'output', 'cos-migration');
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm');

const mediaTypes = new Map([
  ['.jpg', { type: 'image', contentType: 'image/jpeg' }],
  ['.jpeg', { type: 'image', contentType: 'image/jpeg' }],
  ['.png', { type: 'image', contentType: 'image/png' }],
  ['.webp', { type: 'image', contentType: 'image/webp' }],
  ['.gif', { type: 'image', contentType: 'image/gif' }],
  ['.mp4', { type: 'video', contentType: 'video/mp4' }],
  ['.webm', { type: 'video', contentType: 'video/webm' }],
  ['.mp3', { type: 'audio', contentType: 'audio/mpeg' }],
  ['.m4a', { type: 'audio', contentType: 'audio/mp4' }],
  ['.ogg', { type: 'audio', contentType: 'audio/ogg' }],
  ['.wav', { type: 'audio', contentType: 'audio/wav' }],
]);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const storage = createCosStorageFromEnv();
if (!storage) throw new Error('请先在 .env 中填写 COS_SECRET_ID 和 COS_SECRET_KEY');

const config = JSON.parse(await readFile(configPath, 'utf8'));
const paths = collectUploadPaths(config);
const entries = [];
const replacements = new Map();

for (const publicPath of paths) {
  const name = decodeURIComponent(publicPath.slice('/uploads/'.length));
  const definition = mediaTypes.get(extname(name).toLowerCase());
  if (!definition) throw new Error(`不支持迁移的媒体格式: ${publicPath}`);

  const filePath = join(uploadDir, name);
  const info = await stat(filePath);
  const keys = getMediaKeys(name, definition.type);
  const publicKey = keys.variantKey || keys.originalKey;
  const cdnUrl = storage.publicUrl(publicKey);
  replacements.set(publicPath, cdnUrl);
  entries.push({
    publicPath,
    name,
    filePath,
    size: info.size,
    type: definition.type,
    contentType: definition.contentType,
    ...keys,
    cdnUrl,
  });
}

const nextConfig = rewriteUploadPaths(config, replacements);
assertScoreDataUnchanged(config, nextConfig);
await mkdir(reportDir, { recursive: true });
const stamp = timestamp();
const reportPath = join(reportDir, `${stamp}-${apply ? 'apply' : 'dry-run'}.json`);
const summary = {
  mode: apply ? 'apply' : 'dry-run',
  createdAt: new Date().toISOString(),
  files: entries.length,
  bytes: entries.reduce((total, entry) => total + entry.size, 0),
  byType: Object.fromEntries(['image', 'video', 'audio'].map((type) => [
    type,
    entries.filter((entry) => entry.type === type).length,
  ])),
  entries: entries.map(({ filePath: _filePath, contentType: _contentType, ...entry }) => entry),
};

if (!apply) {
  await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
  process.exit(0);
}

if (!confirmed) throw new Error('正式迁移需要同时提供 --apply --confirm');

const backupPath = `${configPath}.pre-cos-${stamp}.bak`;
await copyFile(configPath, backupPath);

for (const entry of entries) {
  await storage.putObject({
    key: entry.originalKey,
    body: createReadStream(entry.filePath),
    contentType: entry.contentType,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  if (entry.variantKey) {
    await storage.putObject({
      key: entry.variantKey,
      body: await createImageVariant(entry.filePath),
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
    });
  }
}

const store = await createConfigStore({ dataDir });
await store.write(nextConfig);
await writeFile(reportPath, `${JSON.stringify({ ...summary, backupPath }, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, backupPath, reportPath }, null, 2));
