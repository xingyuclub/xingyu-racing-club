import { teamData } from './teamData.js';
import { projectScores } from '../../server/lib/scoreLedger.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
const inferMediaType = (src) => /\.(mp4|webm)(?:$|[?#])/i.test(String(src || '')) ? 'video' : 'image';

const createRawScoreRow = ({ id, teamRace, openRace, score, total }) => ({
  id,
  teamRace,
  openRace,
  ...(score !== undefined ? { score } : {}),
  ...(total !== undefined ? { total } : {}),
});

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
  const { team, stats, roster, scoreMembers, albums, dailyScores, weekendScores, memberAliases, news, music } = clone(input);
  const sortedScores = [...dailyScores].sort((left, right) => left.date.localeCompare(right.date));
  const normalizedRoster = roster.map((member) => ({
    ...createRawMember(member, sortedScores),
    signature: typeof member.signature === 'string' ? member.signature : '',
  }));
  const normalizedScoreMembers = Array.isArray(scoreMembers)
    ? scoreMembers
    : normalizedRoster.map(({ id, name, basePoints = 0, wins = 0 }) => ({
        id,
        name,
        basePoints,
        wins,
      }));
  const normalizedTeam = team && typeof team === 'object'
    ? (() => {
        const { heroImage, ...teamWithoutLegacyMedia } = team;
        const heroMedia = team.heroMedia && typeof team.heroMedia === 'object'
          ? team.heroMedia
          : { src: heroImage || '', type: inferMediaType(heroImage) };
        return {
          ...teamWithoutLegacyMedia,
          heroLines: Array.isArray(team.heroLines) && team.heroLines.length
            ? team.heroLines
            : [team.name],
          heroMedia,
          heroFallbackImage: Object.hasOwn(team, 'heroFallbackImage')
            ? team.heroFallbackImage
            : '',
        };
      })()
    : team;

  return {
    team: normalizedTeam,
    stats,
    roster: normalizedRoster,
    scoreMembers: normalizedScoreMembers,
    albums,
    dailyScores: sortedScores.map((round) => ({
      date: round.date,
      rows: round.rows.map(createRawScoreRow),
    })),
    weekendScores: Array.isArray(weekendScores) ? weekendScores : [],
    memberAliases: Array.isArray(memberAliases) ? memberAliases : [],
    news,
    music,
  };
}

export function createSeedConfig() {
  return migrateRawConfig({
    ...teamData,
    music: { src: '/audio/launch-now.mp3', cover: '/images/music-avatar.png' },
  });
}

export function hydrateSiteData(rawConfig) {
  const config = clone(rawConfig);
  const scoreMembersById = new Map(config.scoreMembers.map((member) => [member.id, member]));
  const { totals, dailyDetail } = projectScores({
    dailyScores: config.dailyScores,
    weekendScores: config.weekendScores,
    roster: config.scoreMembers,
  });

  const dailyScores = dailyDetail.map((round) => ({
    date: round.date,
    weekday: round.weekday,
    rows: round.rows.map((row) => ({
      id: row.id,
      name: scoreMembersById.get(row.id)?.name || '',
      teamRace: row.teamRace,
      openRace: row.openRace,
      ...(row.previousPoints !== undefined ? { previousPoints: row.previousPoints } : {}),
      ...(row.previousPointsInherited !== undefined ? { previousPointsInherited: row.previousPointsInherited } : {}),
      ...(row.points !== undefined ? { points: row.points } : {}),
      score: row.score,
      weekTotal: row.weekTotal,
      total: row.total,
    })),
  }));
  const roster = config.roster;
  const latestRound = dailyScores.at(-1);
  const latestDate = latestRound?.date || '';
  const leaderboard = (latestRound?.rows || [])
    .slice()
    .sort(
      (left, right) =>
        right.total - left.total || left.name.localeCompare(right.name),
    )
    .map((row, index) => ({
      id: row.id,
      rank: index + 1,
      name: row.name,
      points: row.total,
    }));
  return {
    ...config,
    roster,
    featuredMembers: roster.slice(0, 8),
    gallery: config.albums.flatMap((album) => album.photos),
    leaderboard,
    latestScoreDate: latestDate,
    dailyScores,
  };
}
