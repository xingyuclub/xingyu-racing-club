import { describe, expect, it } from 'vitest';
import { createSeedConfig, hydrateSiteData, migrateRawConfig } from './siteConfig.js';
import { teamData } from './teamData.js';

describe('site configuration', () => {
  it('migrates roster-backed score identities without changing existing score ids', () => {
    const legacy = createSeedConfig();
    delete legacy.scoreMembers;

    const migrated = migrateRawConfig(legacy);

    expect(migrated.scoreMembers.map(({ id, name }) => ({ id, name }))).toEqual(
      migrated.roster.map(({ id, name }) => ({ id, name })),
    );
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
    expect(config.roster[0]).not.toHaveProperty('points');
    expect(config.dailyScores[0]).not.toHaveProperty('weekday');
    expect(config.dailyScores[0].rows[0]).toEqual({
      id: teamData.roster[0].id,
      teamRace: teamData.dailyScores[0].rows[0].teamRace,
      openRace: teamData.dailyScores[0].rows[0].openRace,
    });
    expect(Object.keys(config).sort()).toEqual([
      'albums',
      'dailyScores',
      'memberAliases',
      'music',
      'news',
      'roster',
      'scoreMembers',
      'stats',
      'team',
      'weekendScores',
    ]);
  });

  it('derives current points and daily totals from opening balances in date order', () => {
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
      total: 19,
    });
    expect(data.dailyScores[1].rows[0].total).toBe(22);
    expect(data.roster[0]).not.toHaveProperty('points');
    expect(data.featuredMembers[0]).not.toHaveProperty('points');
    expect(data.leaderboard).toEqual([expect.objectContaining({
      id: config.roster[0].id,
      points: 22,
      rank: 1,
    })]);
  });

  it('includes the latest-day score members in the leaderboard regardless of roster', () => {
    const config = createSeedConfig();
    config.roster = [{ ...config.roster[0], id: 'roster-1', name: '后台名称' }];
    config.scoreMembers = [{ id: 'score-1', name: 'Excel名称', basePoints: 10, wins: 0 }];
    config.dailyScores = [{
      date: '2026-07-01',
      rows: [{ id: 'score-1', teamRace: [1, 0, 0], openRace: [0, 0, 0] }],
    }];

    const hydrated = hydrateSiteData(config);

    expect(hydrated.roster[0].name).toBe('后台名称');
    expect(hydrated.leaderboard).toEqual([
      { id: 'score-1', rank: 1, name: 'Excel名称', points: 11 },
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

  it('sorts tied leaderboard totals by name', () => {
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

    const sortedByName = [...config.scoreMembers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((member) => member.id);
    expect(data.leaderboard.map((member) => member.id)).toEqual(sortedByName);
  });

  it('sorts tied leaderboard members by name', () => {
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
      config.scoreMembers[1].id,
      config.scoreMembers[0].id,
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

  it('adds weekend scores additively and includes them in the daily detail', () => {
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
    expect(data.dailyScores[1].rows[0].total).toBe(16);
    expect(data.dailyScores[2].rows[0].total).toBe(19);
    expect(data.leaderboard[0].points).toBe(19);
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

    expect(data.leaderboard.map((member) => member.id)).toEqual(['departed-member', config.scoreMembers[0].id]);
    expect(data.dailyScores[0].rows).toHaveLength(2);
    expect(data.dailyScores[0].rows.find((row) => row.id === 'departed-member').total).toBe(5);
  });

  it('shows no leaderboard before any score date has been imported', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.scoreMembers = config.scoreMembers.slice(0, 2).map((member, index) => ({
      ...member,
      basePoints: index === 0 ? 20 : 0,
    }));

    const data = hydrateSiteData(config);

    expect(data.leaderboard).toEqual([]);
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
      date: '2026-08-01',
      rows: [
        { id: 'score-a', teamRace: [4, 0, 0], openRace: [0, 0, 0] },
        { id: 'score-b', teamRace: [6, 0, 0], openRace: [0, 0, 0] },
      ],
    }];
    config.weekendScores = [{
      date: '2026-08-02',
      rows: [
        { id: 'score-a', points: 50, score: 10, total: 50 },
        { id: 'score-b', points: 70, score: 20, total: 70 },
        { id: 'history-only', points: 999, score: 999, total: 999 },
      ],
    }];

    const data = hydrateSiteData(config);

    // Latest date is the weekend 2026-08-02; totals accumulate additively.
    // score-a: 4 + 10 = 14, score-b: 6 + 20 = 26, history-only: 0 + 999 = 999
    expect(data.leaderboard).toEqual([
      { id: 'history-only', rank: 1, name: 'Excel历史人物', points: 999 },
      { id: 'score-b', rank: 2, name: '白榆', points: 26 },
      { id: 'score-a', rank: 3, name: 'ˣʸ༩·青山', points: 14 },
    ]);
    expect(data.latestScoreDate).toBe('2026-08-02');
  });
});
