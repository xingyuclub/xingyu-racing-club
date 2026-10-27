import 'dotenv/config';
import { join } from 'node:path';
import { createConfigStore } from '../server/lib/configStore.js';
import { createCosStorageFromEnv } from '../server/lib/cosStorage.js';
import { createPublicConfigPublisher } from '../server/lib/publicConfigPublisher.js';

const storage = createCosStorageFromEnv();
if (!storage) {
  throw new Error('未检测到完整 COS 配置，请检查 .env 中的 COS_* 字段');
}

const dataDir = join(process.cwd(), 'server', 'data');
const store = await createConfigStore({ dataDir });
const publish = createPublicConfigPublisher({ configStore: store, mediaStorage: storage });
if (!publish) {
  throw new Error('公网配置发布器初始化失败');
}

const result = await publish();
console.log(`公网配置已发布：${result.key}`);
