import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConfigStore } from '../server/lib/configStore.js';
import {
  mergeLegacyScoreImport,
  parseLegacyScoreWorkbook,
} from '../server/lib/legacyScoreWorkbook.js';

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('用法: node scripts/import-legacy-score-workbook.js <xlsx路径>');
}

const configStore = await createConfigStore({ dataDir: resolve('server/data') });
const before = await configStore.read();
const rosterSnapshot = structuredClone(before.roster);
const preview = await parseLegacyScoreWorkbook(await fs.readFile(resolve(filePath)), {
  kw27Monday: '2026-06-29',
});

if (preview.errors.length) {
  throw new Error(`Excel 解析失败: ${JSON.stringify(preview.errors)}`);
}

const next = mergeLegacyScoreImport(before, preview);
if (JSON.stringify(next.roster) !== JSON.stringify(rosterSnapshot)) {
  throw new Error('首次导入不得修改 roster');
}

await configStore.write(next);
console.log(JSON.stringify({
  parsedSheets: preview.parsedSheets,
  scoreMembers: next.scoreMembers.length,
  dailyDates: next.dailyScores.length,
  weekendDates: next.weekendScores.length,
}, null, 2));
