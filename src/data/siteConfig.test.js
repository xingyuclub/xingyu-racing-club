import { describe, expect, it } from 'vitest';
import {
  createSeedConfig,
  getHomeNews,
  hydrateSiteData,
  migrateRawConfig,
  parseNewsDate,
  renumberScoreMemberIds,
  sortNewsPinnedFirstByDateDesc,
} from './siteConfig.js';
import { teamData } from './teamData.js';

describe('site configuration', () => {
  it('adds the default games to old configuration without modifying existing data', () => {
    const legacy = structuredClone(teamData);
    delete legacy.games;
    const migrated = migrateRawConfig(legacy);

    expect(migrated.games.map((game) => game.name)).toEqual([
      '登山赛车',
      '方块消除',
      'Tiny Fishing',
      'Fishing World',
      'Game of Farmers',
      'Fruit Ninja',
      '抓大鹅',
      'Monkey Mart',
    ]);
    expect(migrated.games.every((game) => game.enabled)).toBe(true);
    expect(migrated.team.name).toBe(legacy.team.name);
    expect(migrated.albums).toEqual(legacy.albums.map((album) => ({ ...album, password: '' })));
  });

  it('keeps edited games, their order, and an intentionally empty game list', () => {
    const config = createSeedConfig();
    const games = [...config.games].reverse().map((game) => ({ ...game, enabled: false }));
    expect(migrateRawConfig({ ...config, games }).games).toEqual(games);
    expect(hydrateSiteData({ ...config, games }).games).toEqual(games);
    expect(migrateRawConfig({ ...config, games: [] }).games).toEqual([]);
  });

  it('hydrates the public fallback without newer Object and Array helpers', () => {
    const originalHasOwn = Object.hasOwn;
    const originalAt = Array.prototype.at;

    try {
      Object.hasOwn = undefined;
      Array.prototype.at = undefined;

      expect(() => hydrateSiteData(createSeedConfig())).not.toThrow();
    } finally {
      Object.hasOwn = originalHasOwn;
      Array.prototype.at = originalAt;
    }
  });

  it('renumbers score identities and every stored reference in current list order', () => {
    const config = createSeedConfig();
    config.scoreMembers = [
      { id: 'score-old-a', name: '甲' },
      { id: 'score-old-b', name: '乙' },
    ];
    config.roster = [
      { ...config.roster[0], scoreMemberId: 'score-old-b' },
      { ...config.roster[1], scoreMemberId: 'score-old-a' },
    ];
    config.dailyScores = [{
      date: '2026-08-04',
      rows: [{ id: 'score-old-a', teamRace: [1, null, null], openRace: [null, null, null] }],
    }];
    config.weekendScores = [{
      date: '2026-08-02',
      rows: [{ id: 'score-old-b', points: 20 }],
    }];

    const next = renumberScoreMemberIds(config);

    expect(next.scoreMembers.map((member) => member.id)).toEqual(['1', '2']);
    expect(next.roster.map((member) => member.scoreMemberId)).toEqual(['2', '1']);
    expect(next.dailyScores[0].rows[0].id).toBe('1');
    expect(next.weekendScores[0].rows[0].id).toBe('2');
  });

  it('adds an empty signature to legacy roster members', () => {
    const legacy = structuredClone(teamData);
    delete legacy.roster[0].signature;

    expect(migrateRawConfig(legacy).roster[0].signature).toBe('');
  });

  it('preserves an explicitly configured member signature', () => {
    const input = structuredClone(teamData);
    input.roster[0].signature = '向着终点全速前进';

    expect(migrateRawConfig(input).roster[0].signature).toBe('向着终点全速前进');
  });

  it('migrates roster-backed score identities without changing existing score ids', () => {
    const legacy = createSeedConfig();
    delete legacy.scoreMembers;

    const migrated = migrateRawConfig(legacy);

    expect(migrated.scoreMembers.map(({ id, name }) => ({ id, name }))).toEqual(
      migrated.roster.map(({ id, name }) => ({ id, name })),
    );
  });

  it('auto-binds a roster member when exactly one score identity has the same normalized name', () => {
    const input = structuredClone(teamData);
    input.roster = [{ ...input.roster[0], id: 'roster-1', name: 'ˣʸ༩·青山' }];
    input.scoreMembers = [{ id: 'score-qingshan', name: '青山', basePoints: 0, wins: 0 }];

    expect(migrateRawConfig(input).roster[0].scoreMemberId).toBe('score-qingshan');
  });

  it('keeps an unmatched roster member explicitly unbound', () => {
    const input = structuredClone(teamData);
    input.roster = [{ ...input.roster[0], id: 'roster-1', name: '没有积分身份' }];
    input.scoreMembers = [{ id: 'score-other', name: '其他人', basePoints: 0, wins: 0 }];

    expect(migrateRawConfig(input).roster[0].scoreMemberId).toBe('');
  });

  it('migrates legacy hero image configuration to typed media fields', () => {
    const legacy = structuredClone(teamData);
    legacy.team.heroImage = legacy.team.heroMedia?.src || '/images/legacy-hero.png';
    delete legacy.team.heroMedia;
    delete legacy.team.heroFallbackImage;

    const config = createSeedConfig();
    const migrated = migrateRawConfig(legacy);

    expect(migrated.team).toEqual(expect.objectContaining({
      heroMedia: { src: legacy.team.heroImage, type: 'image' },
      heroFallbackImage: '',
    }));
    expect(migrated.team).not.toHaveProperty('heroImage');
    expect(config.team).toHaveProperty('heroMedia');
  });

  it('preserves an explicitly configured video hero media', () => {
    const input = structuredClone(teamData);
    input.team.heroMedia = { src: '/uploads/hero.mp4', type: 'video' };
    input.team.heroFallbackImage = '/uploads/fallback.png';
    delete input.team.heroImage;

    const migrated = migrateRawConfig(input);

    expect(migrated.team.heroMedia).toEqual({ src: '/uploads/hero.mp4', type: 'video' });
    expect(migrated.team.heroFallbackImage).toBe('/uploads/fallback.png');
  });

  it('infers a legacy video hero image path as video media', () => {
    const legacy = structuredClone(teamData);
    legacy.team.heroImage = '/uploads/legacy-hero.mp4';
    delete legacy.team.heroMedia;

    expect(migrateRawConfig(legacy).team.heroMedia).toEqual({
      src: '/uploads/legacy-hero.mp4',
      type: 'video',
    });
  });

  it('preserves optional news rich text without rewriting legacy news', () => {
    const legacy = structuredClone(teamData);

    expect(migrateRawConfig(legacy).news[0]).not.toHaveProperty('bodyHtml');

    legacy.news[0].bodyHtml = '<p><strong>富文本</strong></p>';
    expect(migrateRawConfig(legacy).news[0].bodyHtml).toBe('<p><strong>富文本</strong></p>');
  });

  it('adds an empty password to legacy albums and preserves configured passwords', () => {
    const legacy = structuredClone(teamData);
    legacy.albums.forEach((album) => delete album.password);

    expect(migrateRawConfig(legacy).albums.every((album) => album.password === '')).toBe(true);

    legacy.albums[0].password = '2468';
    expect(migrateRawConfig(legacy).albums[0].password).toBe('2468');
  });

  it('preserves exact imported score fields during raw migration', () => {
    const input = structuredClone(teamData);
    input.dailyScores[0].rows[0].score = 6;
    input.dailyScores[0].rows[0].total = 18;
    input.weekendScores = [{
      date: '2026-08-01',
      rows: [{ id: input.roster[0].id, previousPoints: 90, points: 142, score: 52, total: 136 }],
    }];

    const migrated = migrateRawConfig(input);

    expect(migrated.dailyScores[0].rows[0]).toMatchObject({ score: 6, total: 18 });
    expect(migrated.weekendScores[0].rows[0]).toMatchObject({ previousPoints: 90 });
  });

  it('creates raw configuration without duplicate derived collections', () => {
    const config = createSeedConfig();

    expect(config).toEqual(expect.objectContaining({
      team: expect.any(Object),
      stats: expect.any(Array),
      roster: expect.any(Array),
      albums: expect.any(Array),
      dailyScores: expect.any(Array),
      news: expect.any(Array),
      music: {
        src: '/audio/launch-now.mp3',
        cover: '/images/music-avatar.png',
      },
    }));
    expect(config).not.toHaveProperty('gallery');
    expect(config).not.toHaveProperty('leaderboard');
    expect(config).not.toHaveProperty('featuredMembers');
    expect(config.roster[0]).toHaveProperty('basePoints');
    expect(config.roster[0]).toHaveProperty('signature', '');
    expect(config.roster[0]).toHaveProperty('scoreMemberId', config.scoreMembers[0].id);
    expect(config.roster[0]).not.toHaveProperty('points');
    expect(config.dailyScores[0]).not.toHaveProperty('weekday');
    expect(config.dailyScores[0].rows[0]).toEqual({
      id: teamData.roster[0].id,
      teamRace: teamData.dailyScores[0].rows[0].teamRace,
      openRace: teamData.dailyScores[0].rows[0].openRace,
      score: teamData.dailyScores[0].rows[0].score,
      total: teamData.dailyScores[0].rows[0].total,
    });
    expect(Object.keys(config).sort()).toEqual([
      'albums',
      'dailyScores',
      'games',
      'memberAliases',
      'music',
      'news',
      'newsCategories',
      'roster',
      'scoreMembers',
      'sectionTitles',
      'stats',
      'team',
      'weekendScores',
    ]);
  });

  it('derives weekly totals from daily scores in date order', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 2);
    config.scoreMembers = config.scoreMembers.slice(0, 2).map((member, index) => ({
      ...member,
      basePoints: index === 0 ? 10 : 30,
      wins: index + 1,
    }));
    config.dailyScores = [
      {
        date: '2026-07-29',
        rows: [{ id: config.scoreMembers[0].id, teamRace: [1, 1, 1], openRace: [0, 0, 0] }],
      },
      {
        date: '2026-07-28',
        rows: [{ id: config.scoreMembers[0].id, teamRace: [2, 2, 2], openRace: [1, 1, 1] }],
      },
    ];

    const data = hydrateSiteData(config);

    expect(data.gallery).toEqual(config.albums.flatMap((album) => album.photos));
    expect(data.dailyScores.map((round) => round.date)).toEqual(['2026-07-28', '2026-07-29']);
    expect(data.dailyScores.map((round) => round.weekday)).toEqual(['周二', '周三']);
    expect(data.leaderboard.map((member) => member.rank)).toEqual(
      data.leaderboard.map((_, index) => index + 1),
    );
    expect(data.dailyScores[0].rows[0]).toMatchObject({
      id: config.scoreMembers[0].id,
      name: config.scoreMembers[0].name,
      score: 9,
      total: 9,
    });
    expect(data.dailyScores[1].rows[0].total).toBe(12);
    expect(data.roster[0]).not.toHaveProperty('points');
    expect(data.featuredMembers[0]).not.toHaveProperty('points');
    expect(data.leaderboard[0]).toMatchObject({
      id: config.scoreMembers[0].id,
      points: 12,
      rank: 1,
    });
    expect(data.leaderboard).toHaveLength(2);

  });

  it('uses independently configured roster and featured member selections', () => {
    const raw = createSeedConfig();
    const featured = [raw.roster[2].id, raw.roster[0].id];
    const roster = [raw.roster[4].id, raw.roster[1].id, raw.roster[3].id];
    const hydrated = hydrateSiteData(migrateRawConfig({
      ...raw,
      roster: raw.roster.map(({ showInFeatured, showInRoster, ...member }) => member),
      sectionMembers: { featured, roster },
    }));
    const expectedFeatured = raw.roster.filter((member) => featured.includes(member.id)).map((member) => member.id);
    const expectedRoster = raw.roster.filter((member) => roster.includes(member.id)).map((member) => member.id);

    expect(hydrated.featuredMembers.map((member) => member.id)).toEqual(expectedFeatured);
    expect(hydrated.roster.map((member) => member.id)).toEqual(expectedRoster);
  });
  it('includes the latest-day score members in the leaderboard regardless of roster', () => {
    const config = createSeedConfig();
    config.roster = [{ ...config.roster[0], id: 'roster-1', name: '后台名称' }];
    config.scoreMembers = [{ id: 'score-1', name: 'Excel名称', basePoints: 10, wins: 0 }];
    config.dailyScores = [{
      date: '2026-08-20',
      rows: [{ id: 'score-1', teamRace: [1, 0, 0], openRace: [0, 0, 0] }],
    }];

    const hydrated = hydrateSiteData(config);

    expect(hydrated.roster[0].name).toBe('后台名称');
    expect(hydrated.leaderboard).toEqual([
      { id: 'score-1', rank: 1, name: 'Excel名称', points: 1, seasonPoints: 1 },
    ]);
    expect(hydrated.dailyScores[0].rows[0].name).toBe('Excel名称');
  });

  it('keeps the configured public member count when some members have no roster card', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 1);
    config.stats = config.stats.map((item) =>
      item.label === '队员数量' ? { ...item, value: '30' } : item,
    );

    const data = hydrateSiteData(config);

    expect(data.stats.find((item) => item.label === '队员数量').value).toBe('30');
    expect(config.stats.find((item) => item.label === '队员数量').value).toBe('30');
  });

  it('sorts tied leaderboard totals by the admin score member order', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.scoreMembers = config.scoreMembers.slice(0, 3).map((member) => ({
      ...member,
      basePoints: 50,
    }));
    config.dailyScores = [{
      date: '2026-07-28',
      rows: config.scoreMembers.map((member) => ({
        id: member.id,
        teamRace: [0, 0, 0],
        openRace: [0, 0, 0],
      })),
    }];

    const data = hydrateSiteData(config);

    expect(data.leaderboard.map((member) => member.id)).toEqual(
      config.scoreMembers.map((member) => member.id),
    );
  });

  it('sorts tied leaderboard members by the admin score member order', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.scoreMembers = config.scoreMembers.slice(0, 2).map((member, index) => ({
      ...member,
      name: index === 0 ? 'Bravo' : 'Alpha',
      basePoints: 50,
      wins: 3,
    }));
    config.roster = config.roster.slice(0, 2).map((member, index) => ({
      ...member,
      name: index === 0 ? 'Bravo' : 'Alpha',
    }));
    config.dailyScores = [{
      date: '2026-07-28',
      rows: config.scoreMembers.map((member) => ({
        id: member.id,
        teamRace: [0, 0, 0],
        openRace: [0, 0, 0],
      })),
    }];

    const data = hydrateSiteData(config);

    expect(data.leaderboard.map((member) => member.id)).toEqual([
      config.scoreMembers[0].id,
      config.scoreMembers[1].id,
    ]);
  });

  it('hydrates a clone without changing the raw configuration', () => {
    const config = createSeedConfig();
    const snapshot = JSON.parse(JSON.stringify(config));

    const data = hydrateSiteData(config);
    data.team.name = 'changed';
    data.roster[0].name = 'changed';
    data.albums[0].photos.push({ id: 'new-photo' });
    data.dailyScores[0].rows[0].teamRace[0] = 999;

    expect(config).toEqual(snapshot);
  });

  it('resets weekly totals at Monday and exposes source weekend fields', () => {
    const config = createSeedConfig();
    config.scoreMembers = config.scoreMembers.slice(0, 1).map((member) => ({ ...member, basePoints: 0 }));
    config.dailyScores = [
      { date: '2026-08-01', rows: [{ id: config.scoreMembers[0].id, teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
      { date: '2026-08-03', rows: [{ id: config.scoreMembers[0].id, teamRace: [3, 0, 0], openRace: [0, 0, 0] }] },
    ];
    config.weekendScores = [
      { date: '2026-08-02', rows: [{ id: config.scoreMembers[0].id, points: 100, score: 12, total: 100 }] },
    ];

    const data = hydrateSiteData(config);

    expect(data.dailyScores.map((round) => round.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(data.dailyScores[0].rows[0].total).toBe(4);
    expect(data.dailyScores[1].rows[0]).toMatchObject({ points: 100, weekTotal: 100, total: 100 });
    expect(data.dailyScores[2].rows[0].total).toBe(3);
    expect(data.leaderboard[0].points).toBe(3);
  });

  it('exposes inherited Saturday baseline metadata', () => {
    const config = createSeedConfig();
    const member = config.scoreMembers[0];
    config.scoreMembers = [member];
    config.dailyScores = [];
    config.weekendScores = [
      { date: '2026-08-09', rows: [{ id: member.id, points: 112 }] },
      { date: '2026-08-15', rows: [{ id: member.id, previousPoints: 999, points: 120 }] },
    ];

    const saturday = hydrateSiteData(config).dailyScores.find(({ date }) => date === '2026-08-15').rows[0];

    expect(saturday).toMatchObject({ previousPoints: 112, previousPointsInherited: true, score: 8 });
  });

  it('ignores an all-blank weekend date when selecting the latest score day', () => {
    const config = createSeedConfig();
    const member = { ...config.scoreMembers[0], basePoints: 0 };
    config.scoreMembers = [member];
    config.dailyScores = [{
      date: '2026-08-01',
      rows: [{ id: member.id, teamRace: [4, 0, 0], openRace: [0, 0, 0], score: 4, total: 4 }],
    }];
    config.weekendScores = [{
      date: '2026-08-02',
      rows: [{ id: member.id, points: null, score: null, total: null }],
    }];

    const data = hydrateSiteData(config);

    expect(data.latestScoreDate).toBe('2026-08-01');
    expect(data.dailyScores.map((round) => round.date)).toEqual(['2026-08-01']);
  });

  it('includes all latest-day score members in the leaderboard sorted by total descending', () => {
    const config = createSeedConfig();
    config.scoreMembers = config.scoreMembers.slice(0, 1).map((member) => ({ ...member, basePoints: 0 }));
    config.dailyScores = [
      {
        date: '2026-08-01',
        rows: [
          { id: config.scoreMembers[0].id, teamRace: [1, 0, 0], openRace: [0, 0, 0] },
          { id: 'departed-member', teamRace: [5, 0, 0], openRace: [0, 0, 0] },
        ],
      },
    ];

    const data = hydrateSiteData(config);

    expect(data.leaderboard.map((member) => member.id)).toEqual([config.scoreMembers[0].id]);
    expect(data.dailyScores[0].rows).toHaveLength(2);
    expect(data.dailyScores[0].rows.find((row) => row.id === 'departed-member').total).toBe(5);
  });

  it('keeps members who played earlier in the week on the leaderboard when they miss the latest day', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.scoreMembers = [
      { id: 'thursday-player', name: '周四队员', basePoints: 0, wins: 0 },
      { id: 'friday-player', name: '周五队员', basePoints: 0, wins: 0 },
    ];
    config.dailyScores = [
      { date: '2026-08-20', rows: [{ id: 'thursday-player', teamRace: [3, 0, 0], openRace: [0, 0, 0] }] },
      { date: '2026-08-21', rows: [{ id: 'friday-player', teamRace: [5, 0, 0], openRace: [0, 0, 0] }] },
    ];

    const data = hydrateSiteData(config);

    expect(data.latestScoreDate).toBe('2026-08-21');
    expect(data.leaderboard).toEqual([
      { id: 'friday-player', rank: 1, name: '周五队员', points: 5, seasonPoints: 5 },
      { id: 'thursday-player', rank: 2, name: '周四队员', points: 3, seasonPoints: 3 },
    ]);
  });

  it('keeps protected album photos out of the homepage gallery', () => {
    const config = createSeedConfig();
    config.albums[0].password = '2468';

    const data = hydrateSiteData(config);
    const protectedIds = new Set(config.albums[0].photos.map((photo) => photo.id));

    expect(data.gallery.some((photo) => protectedIds.has(photo.id))).toBe(false);
  });

  it('shows all score members with zero points before any score date has been imported', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.scoreMembers = config.scoreMembers.slice(0, 2).map((member, index) => ({
      ...member,
      basePoints: index === 0 ? 20 : 0,
    }));

    const data = hydrateSiteData(config);

    expect(data.leaderboard).toHaveLength(2);
    expect(data.leaderboard.every((member) => member.points === 0)).toBe(true);
  });

  it('builds the leaderboard from all score members on the latest imported date', () => {
    const config = createSeedConfig();
    config.roster = [
      { ...config.roster[0], id: 'roster-a', name: '青山' },
      { ...config.roster[1], id: 'roster-b', name: 'ˣʸ༩·白榆' },
    ];
    config.scoreMembers = [
      { id: 'score-a', name: 'ˣʸ༩·青山', basePoints: 0, wins: 0 },
      { id: 'score-b', name: '白榆', basePoints: 0, wins: 0 },
      { id: 'history-only', name: 'Excel历史人物', basePoints: 0, wins: 0 },
    ];
    config.dailyScores = [{
      date: '2026-08-20',
      rows: [
        { id: 'score-a', teamRace: [4, 0, 0], openRace: [0, 0, 0] },
        { id: 'score-b', teamRace: [6, 0, 0], openRace: [0, 0, 0] },
      ],
    }];
    config.weekendScores = [{
      date: '2026-08-22',
      rows: [
        { id: 'score-a', points: 50, score: 10, total: 50 },
        { id: 'score-b', points: 70, score: 20, total: 70 },
        { id: 'history-only', points: 999, score: 999, total: 999 },
      ],
    }];

    const data = hydrateSiteData(config);

    // The weekend source total is the week's exact final score.
    expect(data.leaderboard).toEqual([
      { id: 'history-only', rank: 1, name: 'Excel历史人物', points: 999, seasonPoints: 999 },
      { id: 'score-b', rank: 2, name: '白榆', points: 70, seasonPoints: 26 },
      { id: 'score-a', rank: 3, name: 'ˣʸ༩·青山', points: 50, seasonPoints: 14 },
    ]);
    expect(data.latestScoreDate).toBe('2026-08-22');
  });

  it('calculates season points from the configured start date without a fixed end', () => {
    const config = createSeedConfig();
    const member = { ...config.scoreMembers[0], basePoints: 0 };
    config.scoreMembers = [member];
    config.dailyScores = [
      { date: '2026-08-19', rows: [{ id: member.id, teamRace: [10, 0, 0], openRace: [0, 0, 0], score: 10, total: 10 }] },
      { date: '2026-08-20', rows: [{ id: member.id, teamRace: [2, 0, 0], openRace: [0, 0, 0], score: 2, total: 2 }] },
      { date: '2026-08-21', rows: [{ id: member.id, teamRace: [3, 0, 0], openRace: [0, 0, 0], score: 3, total: 3 }] },
      { date: '2026-08-22', rows: [{ id: member.id, teamRace: [20, 0, 0], openRace: [0, 0, 0], score: 20, total: 20 }] },
    ];

    expect(hydrateSiteData(config).leaderboard[0].seasonPoints).toBe(25);
  });

  it('shows the previous season total for historical date queries', () => {
    const config = createSeedConfig();
    const member = { ...config.scoreMembers[0], basePoints: 0 };
    config.scoreMembers = [member];
    config.dailyScores = [
      { date: '2026-08-18', rows: [{ id: member.id, teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
      { date: '2026-08-20', rows: [{ id: member.id, teamRace: [6, 0, 0], openRace: [0, 0, 0] }] },
    ];

    const rowsByDate = new Map(
      hydrateSiteData(config).dailyScores.map((round) => [round.date, round.rows[0]]),
    );
    expect(rowsByDate.get('2026-08-18').seasonPoints).toBe(4);
    expect(rowsByDate.get('2026-08-20').seasonPoints).toBe(6);
  });
});

describe('news pinning and categories', () => {
  it('defaults legacy news to visible and unpinned while preserving explicit flags', () => {
    const legacy = structuredClone(teamData);
    legacy.news = legacy.news.map(({ pinned, hidden, ...item }) => item);
    expect(migrateRawConfig(legacy).news.map((item) => item.pinned)).toEqual([false, false, false]);
    expect(migrateRawConfig(legacy).news.map((item) => item.hidden)).toEqual([false, false, false]);

    legacy.news[1].pinned = true;
    legacy.news[1].hidden = true;
    expect(migrateRawConfig(legacy).news[1].pinned).toBe(true);
    expect(migrateRawConfig(legacy).news[1].hidden).toBe(true);
  });

  it('keeps hidden news in raw config but removes it from public data', () => {
    const config = createSeedConfig();
    config.news[1].hidden = true;

    expect(config.news[1].hidden).toBe(true);
    expect(hydrateSiteData(config).news.map((item) => item.id)).not.toContain(config.news[1].id);
  });

  it('derives news categories from existing news when missing', () => {
    const legacy = structuredClone(teamData);
    delete legacy.newsCategories;

    expect(migrateRawConfig(legacy).newsCategories).toEqual(['公告', '动态', '战报']);
  });

  it('defaults to 公告 and 活动 when no news supplies categories', () => {
    const legacy = structuredClone(teamData);
    delete legacy.newsCategories;
    legacy.news = [];

    expect(migrateRawConfig(legacy).newsCategories).toEqual(['公告', '活动']);
  });

  it('keeps an explicitly configured category list', () => {
    const input = structuredClone(teamData);
    input.newsCategories = ['公告', '活动'];

    expect(migrateRawConfig(input).newsCategories).toEqual(['公告', '活动']);
  });

  it('shows up to five pinned news in config order', () => {
    const news = Array.from({ length: 6 }, (_, index) => ({
      ...teamData.news[0],
      id: `n${index + 1}`,
      title: `置顶 ${index + 1}`,
      pinned: true,
    }));

    expect(getHomeNews(news).map((item) => item.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('does not show hidden pinned news on the home page', () => {
    const news = [
      { ...teamData.news[0], id: 'hidden', pinned: true, hidden: true },
      { ...teamData.news[1], id: 'visible', pinned: true, hidden: false },
    ];

    expect(getHomeNews(news).map((item) => item.id)).toEqual(['visible']);
  });

  it('falls back to the latest three news when nothing is pinned', () => {
    const news = [
      { ...teamData.news[0], id: 'a', date: '2026.7.1', pinned: false },
      { ...teamData.news[1], id: 'b', date: '2026-08-01', pinned: false },
      { ...teamData.news[2], id: 'c', date: '2026.7.15', pinned: false },
      { ...teamData.news[0], id: 'd', date: '2026-07-20', pinned: false },
    ];

    expect(getHomeNews(news).map((item) => item.id)).toEqual(['b', 'd', 'c']);
  });

  it('sorts pinned news before newer unpinned news on the news page', () => {
    const news = [
      { ...teamData.news[0], id: 'latest', date: '2026-08-10', pinned: false },
      { ...teamData.news[1], id: 'pinned-old', date: '2026-07-01', pinned: true },
      { ...teamData.news[2], id: 'pinned-new', date: '2026-08-01', pinned: true },
      { ...teamData.news[0], id: 'older', date: '2026-07-20', pinned: false },
    ];

    expect(sortNewsPinnedFirstByDateDesc(news).map((item) => item.id)).toEqual([
      'pinned-new',
      'pinned-old',
      'latest',
      'older',
    ]);
  });

  it('parses dot, dash, and slash style news dates', () => {
    expect(parseNewsDate('2026.8.1')).toBe(parseNewsDate('2026-08-01'));
    expect(parseNewsDate('2026/8/1')).toBe(parseNewsDate('2026-08-01'));
    expect(parseNewsDate('x')).toBeNull();
  });
});
