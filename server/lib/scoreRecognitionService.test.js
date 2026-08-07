// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';
import { createScoreRecognitionService } from './scoreRecognitionService.js';

const roster = [
  { id: 'r1', name: '稳稳', scoreMemberId: 's1' },
  { id: 'r2', name: '闪电', scoreMemberId: 's2' },
];
const scoreMembers = [
  { id: 's1', name: '稳稳', basePoints: 0, wins: 0 },
  { id: 's2', name: '闪电', basePoints: 0, wins: 0 },
];

function createFakeConfigStore(config) {
  let current = config;
  return {
    async read() { return structuredClone(current); },
    async write(next) { current = structuredClone(next); return structuredClone(next); },
  };
}

function baseConfig(overrides = {}) {
  return {
    roster,
    scoreMembers,
    dailyScores: [],
    weekendScores: [],
    memberAliases: [],
    ...overrides,
  };
}

function setupService({
  aiResponses = [],
  config = baseConfig(),
  fingerprintImage = async (bytes) => ({
    sha256: Buffer.from(bytes).toString('hex'),
    pixelHash: Buffer.from(bytes).toString('hex'),
    sample: Buffer.from(bytes).toString('base64'),
  }),
  compareFingerprints = (left, right) => (
    left.sha256 === right.sha256 ? 'exact' : 'distinct'
  ),
} = {}) {
  const store = createScoreRecognitionStore({
    dataDir: join(rootDir, 'data'),
    storageDir: join(rootDir, 'storage'),
  });
  const configStore = createFakeConfigStore(config);
  const ai = { extractMatches: vi.fn() };
  for (const response of aiResponses) {
    if (response instanceof Error) ai.extractMatches.mockRejectedValueOnce(response);
    else ai.extractMatches.mockResolvedValueOnce(response);
  }
  const service = createScoreRecognitionService({
    ai,
    store,
    configStore,
    fingerprintImage,
    compareFingerprints,
  });
  return { store, configStore, ai, service };
}

async function createBatch(store, {
  id = 'b1',
  raceType = 'team',
  files = [{ name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' }],
} = {}) {
  await store.createBatch({ id, date: '2026-08-01', raceType, files });
}

let rootDir;
beforeEach(async () => { rootDir = await mkdtemp(join(tmpdir(), 'srv-')); });
afterEach(async () => { await rm(rootDir, { recursive: true, force: true }); });

describe('score recognition service', () => {
  it('recognizes identical uploaded images once and auto-skips the duplicate', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [[{ participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });
    await createBatch(store, {
      files: [
        { name: 'first.jpg', bytes: Buffer.from([7]), mimeType: 'image/jpeg' },
        { name: 'copy.jpg', bytes: Buffer.from([7]), mimeType: 'image/jpeg' },
      ],
    });

    const draft = await service.previewBatch('b1');

    expect(ai.extractMatches).toHaveBeenCalledTimes(1);
    expect(draft.duplicateImageCount).toBe(1);
    expect(draft.suspectedDuplicateImageCount).toBe(0);
    expect(draft.summary).toEqual([
      expect.objectContaining({ id: 's1', score: 1, evidenceIds: ['i0-m0-p0'] }),
    ]);
  });

  it('blocks a visually suspected duplicate until the reviewer resolves it', async () => {
    const { service, store } = setupService({
      aiResponses: [
        [{ participants: [{ nickname: '稳稳', rank: 1, score: 10 }] }],
        [{ participants: [{ nickname: '闪电', rank: 1, score: 11 }] }],
      ],
      compareFingerprints: (left, right) => (
        left.sha256 === right.sha256 ? 'exact' : 'suspected'
      ),
    });
    await createBatch(store, {
      files: [
        { name: 'first.jpg', bytes: Buffer.from([7]), mimeType: 'image/jpeg' },
        { name: 'similar.jpg', bytes: Buffer.from([8]), mimeType: 'image/jpeg' },
      ],
    });

    const draft = await service.previewBatch('b1');
    expect(draft.suspectedDuplicateImageCount).toBe(1);
    expect(draft.canCommit).toBe(false);
    expect(draft.issues).toContainEqual({
      code: 'suspected-duplicate-image',
      imageIndex: 1,
      duplicateOfImageIndex: 0,
    });

    const distinct = await service.reviewBatch('b1', {
      imageIndex: 1,
      notDuplicate: true,
    });
    expect(distinct.suspectedDuplicateImageCount).toBe(0);
    expect(distinct.duplicateImageCount).toBe(0);
    expect(distinct.canCommit).toBe(true);
  });

  it('auto-releases a visually suspected pair when their maps differ', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [
        [{ mapName: '香波岛', participants: [{ nickname: '稳稳', rank: 1, score: 10 }] }],
        [{ mapName: '广寒仙境', participants: [{ nickname: '稳稳', rank: 1, score: 11 }] }],
      ],
      compareFingerprints: (left, right) => (
        left.sha256 === right.sha256 ? 'exact' : 'suspected'
      ),
    });
    await createBatch(store, {
      files: [
        { name: 'first.jpg', bytes: Buffer.from([7]), mimeType: 'image/jpeg' },
        { name: 'similar.jpg', bytes: Buffer.from([8]), mimeType: 'image/jpeg' },
      ],
    });

    const draft = await service.previewBatch('b1');
    expect(ai.extractMatches).toHaveBeenCalledTimes(2);
    expect(draft.autoDistinctImageCount).toBe(1);
    expect(draft.suspectedDuplicateImageCount).toBe(0);
    expect(draft.duplicateImageCount).toBe(0);
    expect(draft.canCommit).toBe(true);
    expect(draft.issues).toEqual([]);
  });

  it('still blocks a visually suspected pair when a map is missing', async () => {
    const { service, store } = setupService({
      aiResponses: [
        [{ mapName: '香波岛', participants: [{ nickname: '稳稳', rank: 1, score: 10 }] }],
        [{ participants: [{ nickname: '稳稳', rank: 1, score: 11 }] }],
      ],
      compareFingerprints: (left, right) => (
        left.sha256 === right.sha256 ? 'exact' : 'suspected'
      ),
    });
    await createBatch(store, {
      files: [
        { name: 'first.jpg', bytes: Buffer.from([7]), mimeType: 'image/jpeg' },
        { name: 'similar.jpg', bytes: Buffer.from([8]), mimeType: 'image/jpeg' },
      ],
    });

    const draft = await service.previewBatch('b1');
    expect(draft.suspectedDuplicateImageCount).toBe(1);
    expect(draft.autoDistinctImageCount).toBe(0);
    expect(draft.canCommit).toBe(false);
  });

  it('stores per-image observations and derives a reviewable draft', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 1 },
        { nickname: '路人', rank: 2 },
      ] }]],
    });
    await createBatch(store);

    const draft = await service.previewBatch('b1');

    expect(draft.canCommit).toBe(false);
    expect(draft.issues).toContainEqual({ evidenceId: 'i0-m0-p1', code: 'unmatched' });
    expect(ai.extractMatches).toHaveBeenCalledWith({
      imageBytes: Buffer.from([1]),
      mimeType: 'image/jpeg',
      multiMatch: false,
    });
    const batch = await store.readBatch('b1');
    expect(batch.status).toBe('ready');
    expect(batch.observations).toEqual([{ imageIndex: 0, matches: [{ participants: [
      { nickname: '稳稳', rank: 1 },
      { nickname: '路人', rank: 2 },
    ] }] }]);
    expect(batch.reviews).toEqual({});
  });

  it('passes the configured team name and short label to nickname recognition', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [[{ participants: [{ nickname: '稳稳', rank: 1 }] }]],
      config: baseConfig({ team: { name: '星\u2060屿车队' } }),
    });
    await createBatch(store);

    await service.previewBatch('b1');

    expect(ai.extractMatches).toHaveBeenCalledWith(expect.objectContaining({
      teamLabels: ['星屿车队', '星屿'],
    }));
  });

  it('recalculates after ignored, member, and rank reviews', async () => {
    const { service, store } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 2 },
        { nickname: '陌生名', rank: 1 },
      ] }]],
    });
    await createBatch(store);
    const first = await service.previewBatch('b1');
    expect(first.canCommit).toBe(false);

    const mapped = await service.reviewBatch('b1', {
      evidenceId: 'i0-m0-p1', memberId: 'r2', ignored: false,
    });
    expect(mapped.canCommit).toBe(true);
    expect(mapped.summary.map((item) => [item.name, item.score]))
      .toEqual([['闪电', 2], ['稳稳', 1]]);

    const ranked = await service.reviewBatch('b1', { evidenceId: 'i0-m0-p0', rank: 1 });
    expect(ranked.canCommit).toBe(false);
    expect(ranked.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-rank' }),
    ]));
    expect((await store.readBatch('b1')).reviews).toEqual({
      'i0-m0-p0': { rank: 1 },
      'i0-m0-p1': { memberId: 'r2', ignored: false },
    });
  });

  it('keeps existing reviews when reprocessing a batch', async () => {
    const { service, store } = setupService({
      aiResponses: [
        [{ participants: [{ nickname: '稳稳', rank: 1 }, { nickname: '路人', rank: 2 }] }],
        [{ participants: [{ nickname: '稳稳', rank: 1 }, { nickname: '路人', rank: 2 }] }],
      ],
    });
    await createBatch(store);
    await service.previewBatch('b1');
    await service.reviewBatch('b1', { evidenceId: 'i0-m0-p1', ignored: true });

    await service.previewBatch('b1');
    const batch = await store.readBatch('b1');
    expect(batch.reviews).toEqual({ 'i0-m0-p1': { ignored: true } });
  });

  it('reprocesses only the selected image and clears only that image reviews', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [
        [{ participants: [{ nickname: '稳稳', rank: 1 }] }],
        [{ participants: [{ nickname: '闪电', rank: 1 }] }],
        [{ participants: [{ nickname: '闪电', rank: 2 }] }],
      ],
    });
    await createBatch(store, { files: [
      { name: 'one.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
      { name: 'two.jpg', bytes: Buffer.from([2]), mimeType: 'image/jpeg' },
    ] });
    await service.previewBatch('b1');
    await store.updateBatch('b1', {
      reviews: {
        'i0-m0-p0': { rank: 2 },
        'i1-m0-p0': { rank: 3 },
      },
    });

    const draft = await service.reprocessImage('b1', 1);
    const batch = await store.readBatch('b1');

    expect(ai.extractMatches).toHaveBeenCalledTimes(3);
    expect(batch.observations[0].matches[0].participants[0].rank).toBe(1);
    expect(batch.observations[1].matches[0].participants[0].rank).toBe(2);
    expect(batch.reviews).toEqual({ 'i0-m0-p0': { rank: 2 } });
    expect(draft.evidence.find((item) => item.imageIndex === 1).rank).toBe(2);
  });

  it('adds and removes a manual participant from one race', async () => {
    const { service, store } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 1 },
        { nickname: '路人', rank: 3 },
      ] }]],
    });
    await createBatch(store);
    await service.previewBatch('b1');
    await service.reviewBatch('b1', { evidenceId: 'i0-m0-p1', ignored: true });

    const added = await service.addManualParticipant('b1', {
      imageIndex: 0,
      matchIndex: 0,
      nickname: '闪电',
      rank: 2,
      scoreMemberId: 's2',
    });
    const manual = added.evidence.find((item) => item.manual);

    expect(added.raceWarnings).toEqual([]);
    expect(manual).toMatchObject({
      nickname: '闪电', rank: 2, scoreMemberId: 's2', manual: true,
    });
    expect(added.summary.find((item) => item.id === 's2')).toMatchObject({ score: 2 });

    const removed = await service.removeManualParticipant('b1', manual.manualEntryId);
    expect(removed.raceWarnings).toEqual([expect.objectContaining({ missingRanks: [2] })]);
    expect(removed.evidence.some((item) => item.manual)).toBe(false);
  });

  it('reviews an unmatched result against a score identity directly', async () => {
    const { service, store } = setupService({
      aiResponses: [[{ participants: [{ nickname: '陌生名', rank: 1 }] }]],
      config: baseConfig({
        roster: [],
        scoreMembers: [{ id: '87', name: '赴约·太困', basePoints: 0, wins: 0 }],
      }),
    });
    await createBatch(store);
    await service.previewBatch('b1');

    const mapped = await service.reviewBatch('b1', {
      evidenceId: 'i0-m0-p0', scoreMemberId: '87', ignored: false,
    });

    expect(mapped).toMatchObject({ issues: [], canCommit: true });
    expect(mapped.summary).toEqual([
      expect.objectContaining({ id: '87', name: '赴约·太困', score: 1 }),
    ]);
    expect((await store.readBatch('b1')).reviews['i0-m0-p0']).toEqual({
      scoreMemberId: '87',
      ignored: false,
    });
  });

  it('blocks commit on suspected duplicates and resolves them by review', async () => {
    const { service, store } = setupService({
      aiResponses: [
        [{ participants: [
          { nickname: '稳稳', rank: 1 },
          { nickname: '闪电', rank: 2 },
        ] }],
        [{ participants: [
          { nickname: '稳稳', rank: 1 },
          { nickname: '闪电', rank: 2 },
        ] }],
      ],
      config: baseConfig(),
    });
    await createBatch(store, {
      files: [
        { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
        { name: 'b.jpg', bytes: Buffer.from([2]), mimeType: 'image/jpeg' },
      ],
    });

    const first = await service.previewBatch('b1');
    expect(first.suspectedDuplicateCount).toBe(1);
    expect(first.canCommit).toBe(false);
    await expect(service.commitBatch('b1', first.rosterVersion)).rejects.toThrow(/无法提交/);

    const distinct = await service.reviewBatch('b1', {
      evidenceId: 'i1-m0-p0', notDuplicate: true,
    });
    expect(distinct.suspectedDuplicateCount).toBe(0);
    expect(distinct.canCommit).toBe(true);
    expect((await store.readBatch('b1')).reviews['i1-m0-p0'].notDuplicate).toBe(true);

    const duplicate = await service.reviewBatch('b1', {
      evidenceId: 'i1-m0-p0', duplicate: true,
    });
    expect(duplicate.duplicateCount).toBe(1);
    expect(duplicate.canCommit).toBe(true);
  });

  it('allows an unmatched participant to be explicitly ignored', async () => {
    const { service, store } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 1 },
        { nickname: '路人', rank: 2 },
      ] }]],
    });
    await createBatch(store);
    const first = await service.previewBatch('b1');

    const reviewed = await service.reviewBatch('b1', {
      evidenceId: first.issues[0].evidenceId,
      ignored: true,
    });

    expect(reviewed.canCommit).toBe(true);
    expect((await store.readBatch('b1')).reviews[first.issues[0].evidenceId])
      .toEqual({ ignored: true });
  });

  it('rejects unknown evidence and member references without saving them', async () => {
    const { service, store } = setupService({
      aiResponses: [[{ participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });
    await createBatch(store);
    await service.previewBatch('b1');

    await expect(service.reviewBatch('b1', { evidenceId: 'missing', ignored: true }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(service.reviewBatch('b1', { evidenceId: 'i0-m0-p0', memberId: 'missing' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect((await store.readBatch('b1')).reviews).toEqual({});
  });

  it('identifies which image failed during sequential recognition', async () => {
    const { service, store } = setupService({
      aiResponses: [
        [{ participants: [{ nickname: '稳稳', rank: 1 }] }],
        new Error('模型超时'),
      ],
    });
    await createBatch(store, { files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
      { name: 'b.jpg', bytes: Buffer.from([2]), mimeType: 'image/jpeg' },
    ] });

    await expect(service.previewBatch('b1')).rejects.toThrow(/第 2 张截图.*模型超时/);
  });

  it('blocks unresolved drafts and commits reviewed evidence into the selected slot', async () => {
    const { service, store, configStore } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 1 },
        { nickname: '路人', rank: 2 },
      ] }]],
    });
    await createBatch(store);
    const draft = await service.previewBatch('b1');

    await expect(service.commitBatch('b1', draft.rosterVersion))
      .rejects.toMatchObject({ statusCode: 422 });
    const reviewed = await service.reviewBatch('b1', { evidenceId: 'i0-m0-p1', ignored: true });
    await service.commitBatch('b1', reviewed.rosterVersion);

    const saved = await configStore.read();
    expect(saved.dailyScores[0]).toEqual({
      date: '2026-08-01',
      rows: [{ id: 's1', teamRace: [2, null, null], openRace: [null, null, null] }],
    });
    expect((await store.readBatch('b1')).status).toBe('committed');
  });

  it('blocks a nickname that has no existing score identity', async () => {
    const config = baseConfig({
      roster: [{ id: 'r3', name: 'ˣʸ༩·新成员', scoreMemberId: '' }],
      scoreMembers: [],
    });
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{ participants: [{ nickname: '新成员', rank: 4 }] }]],
    });
    await createBatch(store, { raceType: 'ranked' });
    const draft = await service.previewBatch('b1');
    expect(draft.canCommit).toBe(false);
    expect(draft.issues).toContainEqual({
      evidenceId: 'i0-m0-p0',
      code: 'unmatched',
    });
    await expect(service.commitBatch('b1', draft.rosterVersion))
      .rejects.toMatchObject({ statusCode: 422 });

    const saved = await configStore.read();
    expect(saved.scoreMembers).toEqual([]);
    expect(saved.dailyScores).toEqual([]);
  });

  it('clears imported totals when adding a score', async () => {
    const config = baseConfig({ dailyScores: [
      { date: '2026-08-01', rows: [
        { id: 's1', teamRace: [1, null, null], openRace: [null, null, null], score: 99, total: 199 },
      ] },
      { date: '2026-08-02', rows: [
        { id: 's1', teamRace: [2, null, null], openRace: [null, null, null], score: 2, total: 201 },
      ] },
    ] });
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{ participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });
    await createBatch(store);
    const draft = await service.previewBatch('b1');
    await service.commitBatch('b1', draft.rosterVersion);

    const saved = await configStore.read();
    expect(saved.dailyScores[0].rows[0]).toMatchObject({ teamRace: [1, 1, null] });
    expect(saved.dailyScores[0].rows[0]).not.toHaveProperty('score');
    expect(saved.dailyScores[0].rows[0]).not.toHaveProperty('total');
    expect(saved.dailyScores[1].rows[0]).not.toHaveProperty('total');
  });

  it('re-matches stored observations with the current matcher without calling the AI again', async () => {
    const { service, store, ai } = setupService({
      aiResponses: [[{ participants: [
        { nickname: '稳稳', rank: 1 },
        { nickname: '路人', rank: 2 },
      ] }]],
    });
    await createBatch(store);
    const first = await service.previewBatch('b1');
    expect(first.issues).toContainEqual({ evidenceId: 'i0-m0-p1', code: 'unmatched' });
    expect(ai.extractMatches).toHaveBeenCalledTimes(1);

    const rematched = await service.rematchBatch('b1');

    expect(ai.extractMatches).toHaveBeenCalledTimes(1);
    expect(rematched.canCommit).toBe(false);
    expect(rematched.issues).toContainEqual({ evidenceId: 'i0-m0-p1', code: 'unmatched' });
    expect((await store.readBatch('b1')).status).toBe('ready');
  });

  it('rematch applies alias changes to stored observations', async () => {
    const { service, store, configStore } = setupService({
      aiResponses: [[{ participants: [{ nickname: '旧名', rank: 1 }] }]],
    });
    await createBatch(store);
    const first = await service.previewBatch('b1');
    expect(first.issues).toContainEqual({ evidenceId: 'i0-m0-p0', code: 'unmatched' });

    const changed = await configStore.read();
    changed.memberAliases = [{ memberId: 'r1', value: '旧名' }];
    await configStore.write(changed);

    const rematched = await service.rematchBatch('b1');
    expect(rematched.canCommit).toBe(true);
    expect(rematched.evidence[0]).toMatchObject({ memberId: 'r1', memberName: '稳稳' });
  });

  it('rejects rematch before the batch has been recognized', async () => {
    const { service, store } = setupService();
    await createBatch(store);
    await expect(service.rematchBatch('b1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks commit when the roster version changes after review', async () => {
    const { service, store, configStore } = setupService({
      aiResponses: [[{ participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });
    await createBatch(store);
    const draft = await service.previewBatch('b1');
    const changed = await configStore.read();
    changed.roster.push({ id: 'r3', name: '新人' });
    await configStore.write(changed);

    await expect(service.commitBatch('b1', draft.rosterVersion))
      .rejects.toMatchObject({ statusCode: 409 });
    expect((await store.readBatch('b1')).status).toBe('ready');
  });
});
