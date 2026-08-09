// @vitest-environment node

import { access, copyFile, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSeedConfig } from '../../src/data/siteConfig.js';
import { createConfigStore } from './configStore.js';

describe('config store', () => {
  const activeFile = 'site-config.json';
  const backupFile = 'site-config.json.bak';
  const candidateFile = 'site-config.json.next';
  const stagedBackupFile = 'site-config.json.bak.next';
  const rawTopLevelKeys = ['team', 'stats', 'roster', 'scoreMembers', 'albums', 'dailyScores', 'weekendScores', 'memberAliases', 'news', 'newsCategories', 'music'];

  let tempDir;
  let dataDir;

  const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });
    return { promise, resolve, reject };
  };

  const readOptionalFile = async (path) => {
    try {
      return await readFile(path);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const readStoreFiles = async () => ({
    active: await readFile(join(dataDir, activeFile)),
    backup: await readOptionalFile(join(dataDir, backupFile)),
  });

  const expectStoreFiles = async ({ active, backup }) => {
    await expect(readFile(join(dataDir, activeFile))).resolves.toEqual(active);
    await expect(readOptionalFile(join(dataDir, backupFile))).resolves.toEqual(backup);
  };

  const expectNoTempFiles = async () => {
    await expect(access(join(dataDir, candidateFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(dataDir, stagedBackupFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  };

  const createFaultInjectedFileSystem = ({ method, targetPath, afterOperation = false }) => {
    const failure = new Error(`${method} ${targetPath} failed`);
    let injected = false;

    const shouldFail = (path) => !injected && path === join(dataDir, targetPath);
    const rejectFailure = () => Promise.reject(failure);

    return {
      copyFile: (fromPath, toPath, ...args) => {
        if (method === 'copyFile' && shouldFail(toPath)) {
          injected = true;
          return rejectFailure();
        }
        return copyFile(fromPath, toPath, ...args);
      },
      writeFile: (path, contents, ...args) => {
        if (method === 'writeFile' && shouldFail(path)) {
          injected = true;
          if (afterOperation) {
            return writeFile(path, contents, ...args).then(rejectFailure);
          }
          return rejectFailure();
        }
        return writeFile(path, contents, ...args);
      },
      rename: (fromPath, toPath, ...args) => {
        if (method === 'rename' && shouldFail(fromPath)) {
          injected = true;
          if (afterOperation) {
            return rename(fromPath, toPath, ...args).then(rejectFailure);
          }
          return rejectFailure();
        }
        return rename(fromPath, toPath, ...args);
      },
    };
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'config-store-'));
    dataDir = join(tempDir, 'nested', 'data');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('seeds a missing configuration file on first read', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    const stored = await readFile(join(dataDir, activeFile), 'utf8');

    expect(config).toEqual(createSeedConfig());
    expect(stored).toBe(`${JSON.stringify(createSeedConfig(), null, 2)}\n`);
    await expect(access(join(dataDir, backupFile))).rejects.toMatchObject({ code: 'ENOENT' });
    await expectNoTempFiles();
  });

  it('rejects score member names that normalize to the same identity', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.scoreMembers = [
      { id: 'a', name: '青山', basePoints: 0, wins: 0 },
      { id: 'b', name: 'ˣʸ༩·青山', basePoints: 0, wins: 0 },
    ];

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([
        'scoreMembers[1].name must be unique after normalization',
      ]),
    });
  });

  it('rejects roster bindings that reference no score member', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.roster[0].scoreMemberId = 'missing-score-member';

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([
        'roster[0].scoreMemberId must reference an existing score member',
      ]),
    });
  });

  it('rejects two roster members bound to the same score member', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.roster[1].scoreMemberId = config.roster[0].scoreMemberId;

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([
        'roster[1].scoreMemberId must be unique',
      ]),
    });
  });

  it.each([
    ['dailyScores', (config) => config.dailyScores[0].rows[0]],
    ['weekendScores', (config) => {
      config.weekendScores = [{
        date: '2026-08-02',
        rows: [{ id: 'missing-score-member', points: 0, score: 0, total: 0 }],
      }];
      return config.weekendScores[0].rows[0];
    }],
  ])('rejects %s rows that reference no score member', async (collection, getRow) => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    getRow(config).id = 'missing-score-member';

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([
        `${collection}[0].rows[0].id must reference an existing score member`,
      ]),
    });
  });

  it('migrates an existing points-based config and backs up its original bytes', async () => {
    const firstStore = await createConfigStore({ dataDir });
    const current = await firstStore.read();
    const legacy = structuredClone(current);
    legacy.roster = legacy.roster.map(({ basePoints, ...member }) => ({
      ...member,
      points: basePoints,
    }));
    legacy.dailyScores = legacy.dailyScores.map((round) => ({
      ...round,
      weekday: '周五',
      rows: round.rows.map((row) => {
        const score = [...row.teamRace, ...row.openRace].reduce((total, value) => total + value, 0);
        const member = legacy.roster.find((item) => item.id === row.id);
        member.points += score;
        return { ...row, name: member.name, score, total: member.points };
      }),
    }));
    const legacyJson = `${JSON.stringify(legacy, null, 2)}\n`;
    await writeFile(join(dataDir, activeFile), legacyJson);

    const migratedStore = await createConfigStore({ dataDir });
    const migrated = await migratedStore.read();

    expect(migrated.roster[0]).toHaveProperty('basePoints', current.roster[0].basePoints);
    expect(migrated.roster[0]).not.toHaveProperty('points');
    expect(migrated.dailyScores[0]).not.toHaveProperty('weekday');
    expect(migrated.dailyScores[0].rows[0]).toEqual(current.dailyScores[0].rows[0]);
    await expect(readFile(join(dataDir, backupFile), 'utf8')).resolves.toBe(legacyJson);
  });

  it('migrates legacy news with pinned defaults and derived categories on read', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    const legacy = structuredClone(config);
    delete legacy.newsCategories;
    legacy.news = legacy.news.map(({ pinned, ...item }) => item);
    const legacyJson = `${JSON.stringify(legacy, null, 2)}\n`;
    await writeFile(join(dataDir, activeFile), legacyJson);

    const migratedStore = await createConfigStore({ dataDir });
    const migrated = await migratedStore.read();

    expect(migrated.news.map((item) => item.pinned)).toEqual(legacy.news.map(() => false));
    expect(migrated.newsCategories).toEqual(['公告', '动态', '战报']);
    await expect(readFile(join(dataDir, backupFile), 'utf8')).resolves.toBe(legacyJson);
  });

  it('writes a formatted configuration and backs up the prior file', async () => {
    const store = await createConfigStore({ dataDir });
    const initial = await store.read();
    const next = { ...initial, team: { ...initial.team, motto: '新口号' } };

    const saved = await store.write(next);
    const stored = await readFile(join(dataDir, 'site-config.json'), 'utf8');
    const backup = await readFile(join(dataDir, 'site-config.json.bak'), 'utf8');

    expect(saved).toEqual(next);
    expect(stored).toBe(`${JSON.stringify(next, null, 2)}\n`);
    expect(backup).toBe(`${JSON.stringify(initial, null, 2)}\n`);
    await expect(access(join(dataDir, 'site-config.json.next'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('accepts album photos with an empty alt', async () => {
    const store = await createConfigStore({ dataDir });
    const next = await store.read();
    next.albums[0].photos[0].alt = '';
    await expect(store.write(next)).resolves.toEqual(next);
  });

  it.each([
    ['stats', (config) => delete config.stats[1], 'stats[1] must be an object'],
    ['roster', (config) => delete config.roster[0], 'roster[0] must be an object'],
    ['albums', (config) => delete config.albums[0], 'albums[0] must be an object'],
    ['photos', (config) => delete config.albums[0].photos[0], 'albums[0].photos[0] must be an object'],
    ['news', (config) => delete config.news[0], 'news[0] must be an object'],
    ['dailyScores', (config) => delete config.dailyScores[0], 'dailyScores[0] must be an object'],
    ['rows', (config) => delete config.dailyScores[0].rows[0], 'dailyScores[0].rows[0] must be an object'],
    [
      'race',
      (config) => delete config.dailyScores[0].rows[0].teamRace[1],
      'dailyScores[0].rows[0].teamRace must contain exactly 3 non-negative finite numbers or null',
    ],
  ])('rejects sparse %s arrays', async (name, mutate, detail) => {
    const store = await createConfigStore({ dataDir });
    const invalid = createSeedConfig();
    mutate(invalid);

    await expect(store.write(invalid)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([detail]),
    });
  });

  it('allows null to represent an unfilled screenshot score slot', async () => {
    const store = await createConfigStore({ dataDir });
    const config = createSeedConfig();
    config.dailyScores[0].rows[0].teamRace = [0, null, null];

    await expect(store.write(config)).resolves.toEqual(config);
  });

  it('captures a deep snapshot at write invocation time', async () => {
    const store = await createConfigStore({ dataDir });
    const initial = await store.read();
    const next = structuredClone(initial);
    next.team.motto = 'captured motto';
    next.roster[0].basePoints = 17;
    next.dailyScores[0].rows[0].teamRace[0] = 9;

    const pendingWrite = store.write(next);
    next.team.motto = 'mutated later';
    next.roster[0].basePoints = 999;
    next.dailyScores[0].rows[0].teamRace[0] = 99;

    const saved = await pendingWrite;
    const stored = JSON.parse(await readFile(join(dataDir, activeFile), 'utf8'));

    expect(saved.team.motto).toBe('captured motto');
    expect(saved.roster[0].basePoints).toBe(17);
    expect(saved.dailyScores[0].rows[0].teamRace[0]).toBe(9);
    expect(stored.team.motto).toBe('captured motto');
    expect(stored.roster[0].basePoints).toBe(17);
    expect(stored.dailyScores[0].rows[0].teamRace[0]).toBe(9);
  });

  it('serializes concurrent writes in invocation order without poisoning later writes', async () => {
    const store = await createConfigStore({ dataDir });
    const initial = await store.read();
    const validConfigs = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(initial),
      team: { ...initial.team, motto: `并发写入 ${index + 1}` },
    }));
    const invalid = structuredClone(initial);
    invalid.roster[0].id = '';

    const results = await Promise.allSettled([
      store.write(validConfigs[0]),
      store.write(validConfigs[1]),
      store.write(invalid),
      ...validConfigs.slice(2).map((config) => store.write(config)),
    ]);
    const stored = JSON.parse(await readFile(join(dataDir, 'site-config.json'), 'utf8'));

    expect(results.map(({ status }) => status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(results[2].reason).toMatchObject({ code: 'INVALID_CONFIG' });
    expect(stored).toEqual(validConfigs.at(-1));
    await expect(store.read()).resolves.toEqual(validConfigs.at(-1));
  });

  it('rejects an invalid member id without changing the stored JSON', async () => {
    const store = await createConfigStore({ dataDir });
    const initial = await store.read();
    const originalJson = await readFile(join(dataDir, 'site-config.json'), 'utf8');
    const invalid = structuredClone(initial);
    invalid.roster[0].id = '';

    await expect(store.write(invalid)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['roster[0].id must be a non-empty string']),
    });
    await expect(readFile(join(dataDir, 'site-config.json'), 'utf8')).resolves.toBe(
      originalJson,
    );
  });

  it.each([
    ['an object avatar', (config) => (config.roster[0].avatar = {}), 'avatar'],
    ['a numeric video URL', (config) => (config.roster[0].videoUrl = 42), 'videoUrl'],
    ['a numeric signature', (config) => (config.roster[0].signature = 42), 'signature'],
  ])('rejects %s', async (name, mutate, field) => {
    const store = await createConfigStore({ dataDir });
    const invalid = createSeedConfig();
    mutate(invalid);

    await expect(store.write(invalid)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([`roster[0].${field} must be a string`]),
    });
  });

  it.each([
    [
      'a numeric hero media source',
      (config) => (config.team.heroMedia.src = 42),
      'team.heroMedia.src must be a string',
    ],
    [
      'an unsupported hero media type',
      (config) => (config.team.heroMedia.type = 'audio'),
      'team.heroMedia.type must be image or video',
    ],
    [
      'a numeric hero fallback image',
      (config) => (config.team.heroFallbackImage = 42),
      'team.heroFallbackImage must be a string',
    ],
  ])('rejects %s', async (_name, mutate, detail) => {
    const store = await createConfigStore({ dataDir });
    const invalid = createSeedConfig();
    mutate(invalid);

    await expect(store.write(invalid)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([detail]),
    });
  });

  it('preserves the active file and existing backup after an invalid write', async () => {
    const store = await createConfigStore({ dataDir });
    const initial = await store.read();
    const next = { ...initial, team: { ...initial.team, motto: 'backup candidate' } };
    await store.write(next);
    const activeJson = await readFile(join(dataDir, 'site-config.json'), 'utf8');
    const backupJson = await readFile(join(dataDir, 'site-config.json.bak'), 'utf8');
    const invalid = structuredClone(next);
    invalid.team.motto = '';

    await expect(store.write(invalid)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await expect(readFile(join(dataDir, 'site-config.json'), 'utf8')).resolves.toBe(activeJson);
    await expect(readFile(join(dataDir, 'site-config.json.bak'), 'utf8')).resolves.toBe(backupJson);
  });

  it.each([
    {
      name: 'candidate write failure',
      failure: { method: 'writeFile', targetPath: candidateFile, afterOperation: true },
    },
    {
      name: 'staged backup copy failure',
      failure: { method: 'copyFile', targetPath: stagedBackupFile },
    },
    {
      name: 'backup rename failure',
      failure: { method: 'rename', targetPath: stagedBackupFile },
    },
    {
      name: 'active rename failure',
      failure: { method: 'rename', targetPath: candidateFile },
    },
  ])('preserves exact active and backup bytes after %s', async ({ failure }) => {
    const initialStore = await createConfigStore({ dataDir });
    const initial = await initialStore.read();
    const current = { ...initial, team: { ...initial.team, motto: 'current active' } };
    await initialStore.write(current);
    const beforeFailure = await readStoreFiles();

    const candidate = { ...current, team: { ...current.team, motto: 'rejected candidate' } };
    const store = await createConfigStore({
      dataDir,
      fileSystem: createFaultInjectedFileSystem(failure),
    });

    await expect(store.write(candidate)).rejects.toThrow(failure.method);
    await expectStoreFiles(beforeFailure);
    await expectNoTempFiles();
  });

  it('removes a staged backup when active rename fails without a prior backup', async () => {
    const store = await createConfigStore({
      dataDir,
      fileSystem: createFaultInjectedFileSystem({
        method: 'rename',
        targetPath: candidateFile,
      }),
    });
    const initial = await createConfigStore({ dataDir }).then((seedStore) => seedStore.read());
    const beforeFailure = await readStoreFiles();
    const candidate = { ...initial, team: { ...initial.team, motto: 'rename rollback' } };

    await expect(store.write(candidate)).rejects.toThrow('rename');
    await expectStoreFiles(beforeFailure);
    await expectNoTempFiles();
  });

  it('reports both the active rename failure and rollback failure', async () => {
    const initialStore = await createConfigStore({ dataDir });
    const initial = await initialStore.read();
    const current = { ...initial, team: { ...initial.team, motto: 'current active' } };
    await initialStore.write(current);
    const candidate = { ...current, team: { ...current.team, motto: 'rejected candidate' } };
    const activeRenameError = new Error('active rename failed');
    const rollbackError = new Error('rollback restore failed');
    let activeRenameFailed = false;
    const fileSystem = {
      rename: (fromPath, toPath, ...args) => {
        if (!activeRenameFailed && fromPath === join(dataDir, candidateFile)) {
          activeRenameFailed = true;
          return Promise.reject(activeRenameError);
        }
        return rename(fromPath, toPath, ...args);
      },
      writeFile: (path, contents, ...args) => {
        if (activeRenameFailed && path === join(dataDir, stagedBackupFile)) {
          return Promise.reject(rollbackError);
        }
        return writeFile(path, contents, ...args);
      },
    };
    const store = await createConfigStore({ dataDir, fileSystem });

    await expect(store.write(candidate)).rejects.toMatchObject({
      name: 'AggregateError',
      code: 'CONFIG_ROLLBACK_FAILED',
      message: 'Failed to replace the active config and restore the previous backup',
      cause: activeRenameError,
      errors: [activeRenameError, rollbackError],
    });
    await expect(access(join(dataDir, candidateFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(join(dataDir, stagedBackupFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('recovers the persisted write queue after a rejected candidate write', async () => {
    const initialStore = await createConfigStore({ dataDir });
    const initial = await initialStore.read();
    const gate = createDeferred();
    const failure = new Error('first candidate write failed');
    let injected = false;
    const fileSystem = {
      writeFile: (path, contents, ...args) => {
        if (!injected && path === join(dataDir, candidateFile)) {
          injected = true;
          return gate.promise.then(() => Promise.reject(failure));
        }
        return writeFile(path, contents, ...args);
      },
    };
    const store = await createConfigStore({ dataDir, fileSystem });
    const first = { ...initial, team: { ...initial.team, motto: 'first queued write' } };
    const second = { ...initial, team: { ...initial.team, motto: 'second queued write' } };

    const firstWrite = store.write(first);
    const secondWrite = store.write(second);
    gate.resolve();

    await expect(firstWrite).rejects.toBe(failure);
    await expect(secondWrite).resolves.toEqual(second);
    await expect(store.read()).resolves.toEqual(second);
    await expectNoTempFiles();
  });

  it.each([
    {
      name: 'unknown score member reference',
      mutate(config) {
        config.dailyScores[0].rows[0].id = 'missing-member';
      },
      detail: 'dailyScores[0].rows[0].id must reference an existing score member',
    },
    {
      name: 'invalid race shape',
      mutate(config) {
        config.dailyScores[0].rows[0].teamRace = [1, 2];
      },
      detail:
        'dailyScores[0].rows[0].teamRace must contain exactly 3 non-negative finite numbers or null',
    },
    {
      name: 'duplicate score date',
      mutate(config) {
        config.dailyScores.push(structuredClone(config.dailyScores[0]));
      },
      detail: 'dailyScores[1].date must be unique',
    },
    {
      name: 'duplicate member on one date',
      mutate(config) {
        config.dailyScores[0].rows.push(structuredClone(config.dailyScores[0].rows[0]));
      },
      detail: 'dailyScores[0].rows[30].id must be unique within its date',
    },
  ])('rejects $name', async ({ mutate, detail }) => {
    const store = await createConfigStore({ dataDir });
    const invalid = await store.read();
    mutate(invalid);

    await expect(store.write(invalid)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([detail]),
    });
  });


  it.each([
    ['a non-object config', () => [], 'config must be an object'],
    [
      'the wrong number of stats',
      (config) => config.stats.pop(),
      'stats must contain exactly 4 entries',
    ],
    [
      'an empty stat label',
      (config) => (config.stats[0].label = ' '),
      'stats[0].label must be a non-empty string',
    ],
    [
      'a non-string stat label',
      (config) => (config.stats[0].label = 42),
      'stats[0].label must be a non-empty string',
    ],
    [
      'an invalid regular stat value',
      (config) => (config.stats[0].value = false),
      'stats[0].value must be a non-empty string or finite number',
    ],
    [
      'an invalid singles stat count',
      (config) => (config.stats[3].value.male = -1),
      'stats[3].value.male must be a non-negative finite number',
    ],
    [
      'a duplicate member id',
      (config) => (config.roster[1].id = config.roster[0].id),
      'roster[1].id must be unique',
    ],
    [
      'a duplicate member number',
      (config) => (config.roster[1].number = config.roster[0].number),
      'roster[1].number must be unique',
    ],
    [
      'an invalid member field',
      (config) => (config.roster[0].role = ''),
      'roster[0].role must be a non-empty string',
    ],
    [
      'an invalid member score',
      (config) => (config.roster[0].wins = Number.POSITIVE_INFINITY),
      'roster[0].wins must be a non-negative finite number',
    ],
    [
      'an invalid opening score',
      (config) => (config.roster[0].basePoints = -1),
      'roster[0].basePoints must be a non-negative finite number',
    ],
    [
      'a derived member points field',
      (config) => (config.roster[0].points = 99),
      'roster[0].points is derived and must not be stored',
    ],
    ['invalid albums', (config) => (config.albums = null), 'albums must be an array'],
    [
      'a duplicate album id',
      (config) => (config.albums[1].id = config.albums[0].id),
      'albums[1].id must be unique',
    ],
    [
      'an invalid album field',
      (config) => (config.albums[0].coverSrc = ''),
      'albums[0].coverSrc must be a non-empty string',
    ],
    [
      'a non-string album password',
      (config) => (config.albums[0].password = 2468),
      'albums[0].password must be a string',
    ],
    [
      'invalid album photos',
      (config) => (config.albums[0].photos = null),
      'albums[0].photos must be an array',
    ],
    [
      'a duplicate photo id',
      (config) => (config.albums[1].photos[0].id = config.albums[0].photos[0].id),
      'albums[1].photos[0].id must be unique',
    ],
    [
      'a non-string photo alt',
      (config) => (config.albums[0].photos[0].alt = 42),
      'albums[0].photos[0].alt must be a string',
    ],
    [
      'an invalid photo media type',
      (config) => (config.albums[0].photos[0].mediaType = 'audio'),
      'albums[0].photos[0].mediaType must be image or video',
    ],
    [
      'an invalid photo featured flag',
      (config) => (config.albums[0].photos[0].featured = 'yes'),
      'albums[0].photos[0].featured must be a boolean',
    ],
    [
      'an invalid photo video URL',
      (config) => (config.albums[0].photos[0].videoUrl = 42),
      'albums[0].photos[0].videoUrl must be a string',
    ],
    ['invalid news', (config) => (config.news = null), 'news must be an array'],
    [
      'a duplicate news id',
      (config) => (config.news[1].id = config.news[0].id),
      'news[1].id must be unique',
    ],
    [
      'an invalid news field',
      (config) => (config.news[0].body = ''),
      'news[0].body must be a non-empty string',
    ],    [
      'a non-boolean news pinned flag',
      (config) => (config.news[0].pinned = 'yes'),
      'news[0].pinned must be a boolean',
    ],
    [
      'a non-array news category list',
      (config) => (config.newsCategories = null),
      'newsCategories must be an array',
    ],
    [
      'an empty news category',
      (config) => (config.newsCategories = ['公告', ' ']),
      'newsCategories[1] must be a non-empty string',
    ],
    [
      'a duplicate news category',
      (config) => (config.newsCategories = ['公告', '公告']),
      'newsCategories[1] must be unique',
    ],
    [
      'an invalid score date',
      (config) => (config.dailyScores[0].date = '2026-02-30'),
      'dailyScores[0].date must use a valid YYYY-MM-DD date',
    ],
    [
      'a derived score round field',
      (config) => (config.dailyScores[0].weekday = '周五'),
      'dailyScores[0].weekday is derived and must not be stored',
    ],
    [
      'an invalid imported daily total',
      (config) => (config.dailyScores[0].rows[0].total = -1),
      'dailyScores[0].rows[0].total must be a non-negative finite number or null',
    ],
    [
      'an invalid race value',
      (config) => (config.dailyScores[0].rows[0].openRace[0] = -1),
      'dailyScores[0].rows[0].openRace must contain exactly 3 non-negative finite numbers or null',
    ],
    [
      'an invalid music field',
      (config) => (config.music.cover = ''),
      'music.cover must be a non-empty string',
    ],
  ])('rejects %s with a concrete field message', async (name, mutate, detail) => {
    const store = await createConfigStore({ dataDir });
    const invalid = createSeedConfig();
    const result = mutate(invalid);
    const candidate = name === 'a non-object config' ? result : invalid;

    await expect(store.write(candidate)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([detail]),
    });
  });

  it('sanitizes news HTML and persists its derived plain text', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.news[0].bodyHtml = '<h2>规则</h2><p onclick="bad()">安全正文</p><img src="/uploads/rule.jpg" alt="规则图">';
    config.news[0].body = '伪造正文';

    const saved = await store.write(config);
    const stored = JSON.parse(await readFile(join(dataDir, activeFile), 'utf8'));

    expect(saved.news[0].bodyHtml).toContain('<h2>规则</h2><p>安全正文</p>');
    expect(saved.news[0].bodyHtml).toContain('/uploads/rule.jpg');
    expect(saved.news[0].body).toMatch(/规则[\s\S]*安全正文/);
    expect(stored.news[0]).toEqual(saved.news[0]);
  });

  it('rejects non-string and empty-after-sanitize rich text', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.news[0].bodyHtml = 42;

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['news[0].bodyHtml must be a string']),
    });

    config.news[0].bodyHtml = '<script>alert(1)</script>';
    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['news[0].bodyHtml must contain readable text']),
    });
  });

  it('persists only the ten raw top-level keys on write', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    const clientConfig = {
      ...config,
      gallery: [{ id: 'derived-photo' }],
      leaderboard: [{ id: 'derived-rank' }],
      featuredMembers: [{ id: 'derived-member' }],
      extraTopLevel: { remove: true },
      team: {
        ...config.team,
        metadata: { keep: true },
      },
    };

    const saved = await store.write(clientConfig);
    const stored = JSON.parse(await readFile(join(dataDir, 'site-config.json'), 'utf8'));

    expect(Object.keys(saved)).toEqual(rawTopLevelKeys);
    expect(Object.keys(stored)).toEqual(rawTopLevelKeys);
    expect(saved.team.metadata).toEqual({ keep: true });
    expect(stored.team.metadata).toEqual({ keep: true });
  });

  it('persists weekend scores and member aliases through migration', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.weekendScores = [
      { date: '2026-08-02', rows: [{ id: config.roster[0].id, previousPoints: 90, points: 100, score: 12, total: 100 }] },
    ];
    config.memberAliases = [{ memberId: config.roster[0].id, value: '老青山' }];

    const saved = await store.write(config);

    expect(saved.weekendScores).toEqual(config.weekendScores);
    expect(saved.memberAliases).toEqual(config.memberAliases);
  });

  it('persists exact imported daily score and week-total fields', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.dailyScores[0].rows[0].score = 6;
    config.dailyScores[0].rows[0].total = 18;

    const saved = await store.write(config);

    expect(saved.dailyScores[0].rows[0]).toMatchObject({ score: 6, total: 18 });
  });

  it('rejects weekend scores with a missing or invalid date', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.weekendScores = [{ date: 'not-a-date', rows: [] }];

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['weekendScores[0].date must use a valid YYYY-MM-DD date']),
    });
  });

  it('drops member aliases that reference a non-existent roster member on write', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.memberAliases = [{ memberId: config.roster[0].id, value: 'valid' }, { memberId: 'ghost-member', value: 'x' }];

    const saved = await store.write(config);
    expect(saved.memberAliases).toEqual([{ memberId: config.roster[0].id, value: 'valid' }]);
  });

  it('rejects a negative weekend total', async () => {
    const store = await createConfigStore({ dataDir });
    const config = await store.read();
    config.weekendScores = [
      { date: '2026-08-02', rows: [{ id: config.roster[0].id, points: -1, score: 0, total: -5 }] },
    ];

    await expect(store.write(config)).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['weekendScores[0].rows[0].total must be a non-negative finite number or null']),
    });
  });

  it('rejects malformed on-disk JSON without silently reseeding it', async () => {
    const store = await createConfigStore({ dataDir });
    const malformed = '{ not valid JSON\n';
    await writeFile(join(dataDir, 'site-config.json'), malformed);

    await expect(store.read()).rejects.toBeInstanceOf(SyntaxError);
    await expect(readFile(join(dataDir, 'site-config.json'), 'utf8')).resolves.toBe(malformed);
  });

  it('rejects invalid on-disk JSON without silently reseeding it', async () => {
    const store = await createConfigStore({ dataDir });
    const invalid = createSeedConfig();
    invalid.team.motto = '';
    const invalidJson = `${JSON.stringify(invalid, null, 2)}\n`;
    await writeFile(join(dataDir, 'site-config.json'), invalidJson);

    await expect(store.read()).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining(['team.motto must be a non-empty string']),
    });
    await expect(readFile(join(dataDir, 'site-config.json'), 'utf8')).resolves.toBe(invalidJson);
  });

  it('rejects unknown top-level keys from on-disk JSON', async () => {
    const store = await createConfigStore({ dataDir });
    const invalid = {
      ...createSeedConfig(),
      extraTopLevel: { shouldRemove: true },
    };
    const invalidJson = `${JSON.stringify(invalid, null, 2)}\n`;
    await writeFile(join(dataDir, activeFile), invalidJson);

    await expect(store.read()).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
      details: expect.arrayContaining([
        'unexpected top-level key "extraTopLevel"; remove it from the config root',
      ]),
    });
    await expect(readFile(join(dataDir, activeFile), 'utf8')).resolves.toBe(invalidJson);
  });
});
