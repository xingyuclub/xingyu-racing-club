import { describe, expect, it } from 'vitest';
import { createSeedConfig, hydrateSiteData } from './siteConfig.js';
import { teamData } from './teamData.js';

describe('site configuration', () => {
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
      'music',
      'news',
      'roster',
      'stats',
      'team',
    ]);
  });

  it('derives current points and daily totals from opening balances in date order', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 2).map((member, index) => ({
      ...member,
      basePoints: index === 0 ? 10 : 30,
      wins: index + 1,
    }));
    config.dailyScores = [
      {
        date: '2026-07-29',
        rows: [{ id: config.roster[0].id, teamRace: [1, 1, 1], openRace: [0, 0, 0] }],
      },
      {
        date: '2026-07-28',
        rows: [{ id: config.roster[0].id, teamRace: [2, 2, 2], openRace: [1, 1, 1] }],
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
      id: config.roster[0].id,
      name: config.roster[0].name,
      score: 9,
      total: 19,
    });
    expect(data.dailyScores[1].rows[0].total).toBe(22);
    expect(data.roster[0].points).toBe(22);
    expect(data.featuredMembers[0].points).toBe(22);
    expect(data.leaderboard[0]).toMatchObject({ id: config.roster[1].id, points: 30, rank: 1 });
  });

  it('derives the public member count stat from the roster length', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 1);
    config.stats = config.stats.map((item) =>
      item.label === '队员数量' ? { ...item, value: '30' } : item,
    );

    const data = hydrateSiteData(config);

    expect(data.stats.find((item) => item.label === '队员数量').value).toBe('1');
    expect(config.stats.find((item) => item.label === '队员数量').value).toBe('30');
  });

  it('sorts tied leaderboard members by wins and then member number', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.roster = config.roster.slice(0, 3).map((member) => ({
      ...member,
      basePoints: 50,
      wins: member.number === '02' ? 4 : 3,
    }));

    const data = hydrateSiteData(config);

    expect(data.leaderboard.map((member) => member.id)).toEqual([
      config.roster[1].id,
      config.roster[0].id,
      config.roster[2].id,
    ]);
  });

  it('sorts tied leaderboard member numbers naturally', () => {
    const config = createSeedConfig();
    config.dailyScores = [];
    config.roster = config.roster.slice(0, 2).map((member, index) => ({
      ...member,
      number: index === 0 ? '2' : '10',
      basePoints: 50,
      wins: 3,
    }));

    const data = hydrateSiteData(config);

    expect(data.leaderboard.map((member) => member.id)).toEqual([
      config.roster[0].id,
      config.roster[1].id,
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
});
