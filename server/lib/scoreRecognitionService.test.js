// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';
import { createScoreRecognitionService } from './scoreRecognitionService.js';

const roster = [
  { id: 'r1', name: '稳稳' },
  { id: 'r2', name: '闪电' },
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

function setupService({ aiResponses = [], config = baseConfig() } = {}) {
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
  const service = createScoreRecognitionService({ ai, store, configStore });
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

  it('writes ranked scores into openRace and creates a missing score identity', async () => {
    const config = baseConfig({
      roster: [{ id: 'r3', name: 'ˣʸ༩·新成员' }],
      scoreMembers: [],
    });
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{ participants: [{ nickname: '新成员', rank: 4 }] }]],
    });
    await createBatch(store, { raceType: 'ranked' });
    const draft = await service.previewBatch('b1');
    await service.commitBatch('b1', draft.rosterVersion);

    const saved = await configStore.read();
    expect(saved.scoreMembers).toContainEqual({
      id: 'score:%E6%96%B0%E6%88%90%E5%91%98',
      name: 'ˣʸ༩·新成员',
      basePoints: 0,
      wins: 0,
    });
    expect(saved.dailyScores[0].rows[0].openRace).toEqual([1, null, null]);
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
