import { describe, expect, it } from 'vitest';
import { createSeedConfig, hydrateSiteData } from './siteConfig.js';

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

  it('derives gallery, featured members, ranks and daily score display values', () => {
    const config = createSeedConfig();
    config.roster[0] = { ...config.roster[0], points: 7, wins: 1 };
    config.roster[1] = { ...config.roster[1], points: 99, wins: 2 };

    const data = hydrateSiteData(config);

    expect(data.gallery).toEqual(config.albums.flatMap((album) => album.photos));
    expect(data.featuredMembers).toEqual(config.roster.slice(0, 8));
    expect(data.leaderboard[0]).toMatchObject({ id: config.roster[1].id, rank: 1 });
    expect(data.leaderboard.map((member) => member.rank)).toEqual(
      data.leaderboard.map((_, index) => index + 1),
    );
    expect(data.dailyScores[0].rows[0]).toMatchObject({
      id: config.roster[0].id,
      name: config.roster[0].name,
      total: 7,
      score: 18,
    });
  });

  it('sorts tied leaderboard members by wins and then member number', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 3).map((member) => ({
      ...member,
      points: 50,
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
    config.roster = config.roster.slice(0, 2).map((member, index) => ({
      ...member,
      number: index === 0 ? '2' : '10',
      points: 50,
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
