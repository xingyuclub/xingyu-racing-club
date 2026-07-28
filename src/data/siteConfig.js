import { teamData } from './teamData.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

export function createSeedConfig() {
  const { team, stats, roster, albums, dailyScores, news } = clone(teamData);

  return {
    team,
    stats,
    roster,
    albums,
    dailyScores,
    news,
    music: {
      src: '/audio/launch-now.mp3',
      cover: '/images/music-avatar.png',
    },
  };
}

export function hydrateSiteData(rawConfig) {
  const config = clone(rawConfig);
  const membersById = new Map(config.roster.map((member) => [member.id, member]));
  const leaderboard = [...config.roster]
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.wins - left.wins ||
        left.number.localeCompare(right.number, undefined, { numeric: true }),
    )
    .map((member, index) => ({
      id: member.id,
      rank: index + 1,
      name: member.name,
      points: member.points,
      wins: member.wins,
    }));

  return {
    ...config,
    featuredMembers: config.roster.slice(0, 8),
    gallery: config.albums.flatMap((album) => album.photos),
    leaderboard,
    dailyScores: config.dailyScores.map((round) => ({
      ...round,
      rows: round.rows.map((row) => {
        const member = membersById.get(row.id);
        const teamRace = [...row.teamRace];
        const openRace = [...row.openRace];

        return {
          ...row,
          name: member?.name || row.name,
          teamRace,
          openRace,
          score: sum([...teamRace, ...openRace]),
          total: member?.points ?? row.total,
        };
      }),
    })),
  };
}
