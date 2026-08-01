import { teamData } from './teamData.js';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

const formatWeekday = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

const createRawMember = (member, sortedScores) => {
  if (Number.isFinite(member.basePoints)) {
    const { points, ...rawMember } = member;
    return rawMember;
  }
  const firstRound = sortedScores.find((round) => round.rows.some((row) => row.id === member.id));
  const firstRow = firstRound?.rows.find((row) => row.id === member.id);
  const firstScore = firstRow ? sum([...firstRow.teamRace, ...firstRow.openRace]) : 0;
  const currentPoints = Number(firstRow?.total ?? member.points ?? 0);
  const { points, ...rawMember } = member;

  return {
    ...rawMember,
    basePoints: Math.max(0, currentPoints - firstScore),
  };
};

export function migrateRawConfig(input) {
  const { team, stats, roster, albums, dailyScores, news, music } = clone(input);
  const sortedScores = [...dailyScores].sort((left, right) => left.date.localeCompare(right.date));
  const normalizedTeam = team && typeof team === 'object'
    ? {
        ...team,
        heroLines: Array.isArray(team.heroLines) && team.heroLines.length
          ? team.heroLines
          : [team.name],
      }
    : team;

  return {
    team: normalizedTeam,
    stats,
    roster: roster.map((member) => createRawMember(member, sortedScores)),
    albums,
    dailyScores: sortedScores.map((round) => ({
      date: round.date,
      rows: round.rows.map(({ id, teamRace, openRace }) => ({
        id,
        teamRace,
        openRace,
      })),
    })),
    news,
    music,
  };
}

export function createSeedConfig() {
  return migrateRawConfig({
    ...teamData,
    music: {
      src: '/audio/launch-now.mp3',
      cover: '/images/music-avatar.png',
    },
  });
}

export function hydrateSiteData(rawConfig) {
  const config = clone(rawConfig);
  const membersById = new Map(config.roster.map((member) => [member.id, member]));
  const totals = new Map(
    config.roster.map((member) => [member.id, Number(member.basePoints ?? member.points ?? 0)]),
  );
  const dailyScores = [...config.dailyScores]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((round) => ({
      date: round.date,
      weekday: formatWeekday(round.date),
      rows: round.rows.map((row) => {
        const teamRace = [...row.teamRace];
        const openRace = [...row.openRace];
        const score = sum([...teamRace, ...openRace]);
        const total = (totals.get(row.id) || 0) + score;
        totals.set(row.id, total);

        return {
          id: row.id,
          name: membersById.get(row.id)?.name || '',
          teamRace,
          openRace,
          score,
          total,
        };
      }),
    }));
  const roster = config.roster.map((member) => ({
    ...member,
    points: totals.get(member.id) || 0,
  }));
  const leaderboard = [...roster]
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
  const stats = config.stats.map((item) =>
    item.label === '队员数量' ? { ...item, value: String(roster.length) } : item,
  );

  return {
    ...config,
    stats,
    roster,
    featuredMembers: roster.slice(0, 8),
    gallery: config.albums.flatMap((album) => album.photos),
    leaderboard,
    dailyScores,
  };
}
