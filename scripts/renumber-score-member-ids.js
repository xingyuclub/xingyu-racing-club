import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createConfigStore } from '../server/lib/configStore.js';
import { createScoreRecognitionService } from '../server/lib/scoreRecognitionService.js';
import { createScoreRecognitionStore } from '../server/lib/scoreRecognitionStore.js';
import { renumberScoreMemberIds } from '../src/data/siteConfig.js';

const rootDir = process.cwd();
const dataDir = join(rootDir, 'server', 'data');
const configPath = join(dataDir, 'site-config.json');
const recognitionDataDir = join(dataDir, 'score-recognition');
const recognitionIndexPath = join(recognitionDataDir, 'score-recognition-index.json');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');

const configStore = await createConfigStore({ dataDir });
const before = await configStore.read();
const idMap = new Map(before.scoreMembers.map((member, index) => [
  member.id,
  String(index + 1),
]));
const rosterScoreIds = new Map(
  before.roster.map((member) => [member.id, member.scoreMemberId]),
);

await copyFile(configPath, `${configPath}.${stamp}.bak`);
await configStore.write(renumberScoreMemberIds(before));

let batches = {};
try {
  batches = JSON.parse(await readFile(recognitionIndexPath, 'utf8'));
  await copyFile(recognitionIndexPath, `${recognitionIndexPath}.${stamp}.bak`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const batch of Object.values(batches)) {
  for (const review of Object.values(batch.reviews || {})) {
    const oldScoreMemberId = review.scoreMemberId || rosterScoreIds.get(review.memberId);
    if (idMap.has(oldScoreMemberId)) review.scoreMemberId = idMap.get(oldScoreMemberId);
    delete review.memberId;
  }
}

if (Object.keys(batches).length > 0) {
  const temporaryPath = `${recognitionIndexPath}.next`;
  await writeFile(temporaryPath, `${JSON.stringify(batches, null, 2)}\n`);
  await rename(temporaryPath, recognitionIndexPath);

  const recognitionStore = createScoreRecognitionStore({
    dataDir: recognitionDataDir,
    storageDir: join(rootDir, 'server', 'storage', 'score-recognition'),
  });
  const service = createScoreRecognitionService({
    ai: {},
    store: recognitionStore,
    configStore,
  });
  for (const batch of Object.values(batches)) {
    if (!['ready', 'committed'].includes(batch.status) || !batch.observations?.length) continue;
    await service.rematchBatch(batch.id);
    if (batch.status === 'committed') {
      await recognitionStore.updateBatch(batch.id, { status: 'committed' });
    }
  }
}

const after = await configStore.read();
console.log(JSON.stringify({
  scoreMembers: after.scoreMembers.length,
  firstId: after.scoreMembers[0]?.id,
  lastId: after.scoreMembers.at(-1)?.id,
  recognitionBatches: Object.keys(batches).length,
}, null, 2));
