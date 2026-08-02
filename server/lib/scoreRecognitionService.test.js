// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';
import { createScoreRecognitionService } from './scoreRecognitionService.js';

const roster = [
  { id: '1', name: '稳稳', number: '1', basePoints: 0, wins: 0 },
  { id: '2', name: '闪电', number: '2', basePoints: 0, wins: 0 },
];
const scoreMembers = roster.map(({ id, name, basePoints, wins }) => ({
  id,
  name,
  basePoints,
  wins,
}));

function createFakeConfigStore(config) {
  let current = config;
  return {
    async read() { return structuredClone(current); },
    async write(next) { current = structuredClone(next); return structuredClone(next); },
  };
}

function setupService({ aiResponses, config }) {
  const dataDir = join(rootDir, 'data');
  const storageDir = join(rootDir, 'storage');
  const store = createScoreRecognitionStore({ dataDir, storageDir });
  const configStore = createFakeConfigStore(config);
  const ai = { extractMatches: vi.fn() };
  aiResponses.forEach((response) => ai.extractMatches.mockResolvedValueOnce(response));
  const service = createScoreRecognitionService({ ai, store, configStore });
  return { store, configStore, ai, service };
}

let rootDir;
beforeEach(async () => { rootDir = await mkdtemp(join(tmpdir(), 'srv-')); });
afterEach(async () => { await rm(rootDir, { recursive: true, force: true }); });

describe('score recognition service', () => {
  it('classifies mixed race types and matches team members with scores', async () => {
    const config = { roster, scoreMembers, dailyScores: [], weekendScores: [], memberAliases: [] };
    const { service, store } = setupService({
      config,
      aiResponses: [[
        { title: '队内赛', date: '2026-08-01', time: '10:00:00',
          participants: [{ nickname: '稳稳', rank: 1 }, { nickname: '路人', rank: 2 }, { nickname: '闪电', rank: 3 }] },
        { title: '排位赛之夜', date: '2026-08-01', time: '11:00:00',
          participants: [{ nickname: '稳稳', rank: 4 }, { nickname: '闪电', rank: 6 }] },
      ]],
    });

    await store.createBatch({ id: 'b1', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b1');

    expect(preview.races).toHaveLength(2);
    const team = preview.races.find((r) => r.type === 'team');
    const ranked = preview.races.find((r) => r.type === 'ranked');
    expect(team.members.map((m) => [m.id, m.score])).toEqual([['1', 3], ['2', 1]]);
    expect(team.members.every((m) => m.slot === 0)).toBe(true);
    expect(ranked.members.map((m) => [m.id, m.score])).toEqual([['1', 2], ['2', 1]]);
  });

  it('skips duplicate races without consuming member slots', async () => {
    const config = { roster, scoreMembers, dailyScores: [], weekendScores: [], memberAliases: [] };
    const sameMatch = [{ title: '队内赛', date: '2026-08-01', time: '10:00:00',
      participants: [{ nickname: '稳稳', rank: 1 }] }];
    const { service, store } = setupService({ config, aiResponses: [sameMatch, sameMatch] });

    await store.createBatch({ id: 'b2', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
      { name: 'b.jpg', bytes: Buffer.from([2]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b2');

    expect(preview.races.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(preview.races.filter((r) => r.duplicate)).toHaveLength(1);
  });

  it('skips members already at the 3-game limit', async () => {
    const config = {
      roster,
      scoreMembers,
      dailyScores: [{ date: '2026-08-01', rows: [
        { id: '1', teamRace: [3, 3, 3], openRace: [] },
      ] }],
      weekendScores: [], memberAliases: [],
    };
    const { service, store } = setupService({
      config,
      aiResponses: [[{ title: '队内赛', date: '2026-08-01', time: '10:00:00',
        participants: [{ nickname: '稳稳', rank: 1 }, { nickname: '闪电', rank: 2 }] }]],
    });

    await store.createBatch({ id: 'b3', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b3');

    const steady = preview.races[0].members.find((m) => m.id === '1');
    const bolt = preview.races[0].members.find((m) => m.id === '2');
    expect(steady.skipped).toBe('member-limit');
    expect(bolt.slot).toBe(0);
  });

  it('matches aliases and reports unmatched nicknames', async () => {
    const config = {
      roster,
      scoreMembers,
      dailyScores: [], weekendScores: [],
      memberAliases: [{ memberId: '1', value: '老稳' }],
    };
    const { service, store } = setupService({
      config,
      aiResponses: [[{ title: '队内赛', date: '2026-08-01', time: '10:00:00',
        participants: [{ nickname: '老稳', rank: 1 }, { nickname: '完全不认识', rank: 2 }] }]],
    });

    await store.createBatch({ id: 'b4', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b4');

    const alias = preview.races[0].members.find((m) => m.id === '1');
    expect(alias.score).toBe(2);
    expect(preview.races[0].unmatched).toEqual(['完全不认识']);
  });

  it('commits confirmed races into the config atomically and tracks the version', async () => {
    const config = { roster, scoreMembers, dailyScores: [], weekendScores: [], memberAliases: [] };
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{ title: '队内赛', date: '2026-08-01', time: '10:00:00',
        participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });

    await store.createBatch({ id: 'b5', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b5');
    await service.commitBatch('b5', preview.rosterVersion);

    const saved = await configStore.read();
    expect(saved.dailyScores).toHaveLength(1);
    expect(saved.dailyScores[0].date).toBe('2026-08-01');
    expect(saved.dailyScores[0].rows[0]).toEqual({ id: '1', teamRace: [1, 0, 0], openRace: [0, 0, 0] });
    expect((await store.readBatch('b5')).status).toBe('committed');
  });

  it('writes a prefixed roster member into the existing unprefixed score identity', async () => {
    const config = {
      roster: [{ id: 'r1', name: 'ˣʸ༩·青山' }],
      scoreMembers: [{ id: 'score:existing', name: '青山', basePoints: 0, wins: 0 }],
      dailyScores: [],
      weekendScores: [],
      memberAliases: [],
    };
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{
        title: '队内赛',
        date: '2026-08-01',
        time: '10:00:00',
        participants: [{ nickname: '青山', rank: 1 }],
      }]],
    });
    await store.createBatch({ id: 'existing-score', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ] });

    const preview = await service.previewBatch('existing-score');
    await service.commitBatch('existing-score', preview.rosterVersion);

    const saved = await configStore.read();
    expect(saved.dailyScores[0].rows[0].id).toBe('score:existing');
    expect(saved.scoreMembers).toEqual(config.scoreMembers);
  });

  it('creates a score member for a newly recognized roster name', async () => {
    const config = {
      roster: [{ id: 'r2', name: 'ˣʸ༩·新成员' }],
      scoreMembers: [],
      dailyScores: [],
      weekendScores: [],
      memberAliases: [],
    };
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{
        title: '队内赛',
        date: '2026-08-01',
        time: '10:00:00',
        participants: [{ nickname: '新成员', rank: 1 }],
      }]],
    });
    await store.createBatch({ id: 'new-score', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ] });

    const preview = await service.previewBatch('new-score');
    await service.commitBatch('new-score', preview.rosterVersion);

    const saved = await configStore.read();
    expect(saved.scoreMembers).toContainEqual({
      id: 'score:%E6%96%B0%E6%88%90%E5%91%98',
      name: 'ˣʸ༩·新成员',
      basePoints: 0,
      wins: 0,
    });
    expect(saved.dailyScores[0].rows[0].id).toBe('score:%E6%96%B0%E6%88%90%E5%91%98');
  });

  it('blocks commit when the roster version changed during preview', async () => {
    const config = { roster, scoreMembers, dailyScores: [], weekendScores: [], memberAliases: [] };
    const { service, store, configStore } = setupService({
      config,
      aiResponses: [[{ title: '队内赛', date: '2026-08-01', time: '10:00:00',
        participants: [{ nickname: '稳稳', rank: 1 }] }]],
    });

    await store.createBatch({ id: 'b6', date: '2026-08-01', files: [
      { name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' },
    ]});
    const preview = await service.previewBatch('b6');

    // Simulate an external roster change between preview and commit.
    const changed = await configStore.read();
    changed.roster.push({ id: '3', name: '新人', number: '3', basePoints: 0, wins: 0 });
    await configStore.write(changed);

    await expect(service.commitBatch('b6', preview.rosterVersion))
      .rejects.toThrow(/roster|version|成员/i);
    expect((await store.readBatch('b6')).status).not.toBe('committed');
  });
});
