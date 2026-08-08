import 'dotenv/config';
import { Buffer } from 'node:buffer';
import { createCosStorageFromEnv } from '../server/lib/cosStorage.js';

const storage = createCosStorageFromEnv();
if (!storage) {
  throw new Error('未检测到完整 COS 配置，请检查 .env 中的 COS_* 字段');
}

const key = `test/cos-smoke-${Date.now()}.webp`;
const body = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary');
let uploaded = false;

try {
  await storage.putObject({
    key,
    body,
    contentType: 'image/webp',
    cacheControl: 'no-cache',
  });
  uploaded = true;

  const url = storage.publicUrl(key);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`CDN 访问失败：HTTP ${response.status}`);
  }

  console.log(JSON.stringify({
    upload: 'ok',
    cdn: 'ok',
    status: response.status,
    contentType: response.headers.get('content-type'),
    urlHost: new URL(url).host,
  }, null, 2));
} catch (error) {
  console.error(`COS 连接验证失败：${error?.code || error?.message || error}`);
  if (error?.code === 'NoSuchBucket') {
    console.error('请检查 .env 中 COS_BUCKET 的完整名称和 COS_REGION 是否与腾讯云控制台一致。');
  }
  process.exitCode = 1;
} finally {
  if (uploaded) await storage.deleteObject(key).catch(() => undefined);
}
