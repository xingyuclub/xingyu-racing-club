import { teamData } from './teamData.js';
import { projectScores } from '../../server/lib/scoreLedger.js';
import { buildScoreMemberMatcher } from './scoreRules.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

export function nextScoreMemberId(scoreMembers = []) {
  const used = new Set(scoreMembers.map((member) => String(member.id || '').trim()));
  let id = 1;
  while (used.has(String(id))) id += 1;
  return String(id);
}

export function removeScoreMember(config, id) {
  const next = clone(config);
  next.scoreMembers = (next.scoreMembers || []).filter((member) => member.id !== id);
  next.dailyScores = (next.dailyScores || []).map((round) => ({
    ...round,
    rows: (round.rows || []).filter((row) => row.id !== id),
  }));
  next.weekendScores = (next.weekendScores || []).map((round) => ({
    ...round,
    rows: (round.rows || []).filter((row) => row.id !== id),
  }));
  next.roster = (next.roster || []).map((member) => (
    member.scoreMemberId === id ? { ...member, scoreMemberId: '' } : member
  ));
  return next;
}

export function renumberScoreMemberIds(config) {
  const next = clone(config);
  const idMap = new Map((next.scoreMembers || []).map((member, index) => [
    member.id,
    String(index + 1),
  ]));
  next.scoreMembers = (next.scoreMembers || []).map((member) => ({
    ...member,
    id: idMap.get(member.id),
  }));
  const remapRounds = (rounds = []) => rounds.map((round) => ({
    ...round,
    rows: (round.rows || []).map((row) => ({ ...row, id: idMap.get(row.id) || row.id })),
  }));
  next.dailyScores = remapRounds(next.dailyScores);
  next.weekendScores = remapRounds(next.weekendScores);
  next.roster = (next.roster || []).map((member) => ({
    ...member,
    scoreMemberId: idMap.get(member.scoreMemberId) || '',
  }));
  return next;
}
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
  const { team, stats, roster, scoreMembers, albums, dailyScores, weekendScores, memberAliases, news, newsCategories, music } = clone(input);
  const sortedScores = [...dailyScores].sort((left, right) => left.date.localeCompare(right.date));
  const normalizedNews = (Array.isArray(news) ? news : []).map((item) => ({
    pinned: false,
    ...item,
  }));
  const derivedCategories = [
    ...new Set(
      normalizedNews
        .map((item) => item?.category)
        .filter((category) => typeof category === 'string' && category.trim().length > 0),
    ),
  ];
  const normalizedNewsCategories = Array.isArray(newsCategories)
    ? newsCategories
    : derivedCategories.length > 0
      ? derivedCategories
      : ['公告', '活动'];
  const rosterMembers = roster.map((member) => ({
    ...createRawMember(member, sortedScores),
    signature: typeof member.signature === 'string' ? member.signature : '',
  }));
  const normalizedScoreMembers = Array.isArray(scoreMembers)
    ? scoreMembers
    : rosterMembers.map(({ id, name, basePoints = 0, wins = 0 }) => ({
        id,
        name,
        basePoints,
        wins,
      }));
  const scoreMemberIds = new Set(normalizedScoreMembers.map((member) => member.id));
  const matchScoreMember = buildScoreMemberMatcher(normalizedScoreMembers);
  const normalizedRoster = rosterMembers.map((member) => ({
    ...member,
    scoreMemberId: typeof member.scoreMemberId === 'string' && scoreMemberIds.has(member.scoreMemberId)
      ? member.scoreMemberId
      : matchScoreMember(member.name) || '',
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
  const normalizedAlbums = (Array.isArray(albums) ? albums : []).map((album) => ({
    ...album,
    password: typeof album.password === 'string' ? album.password : '',
  }));

  return {
    team: normalizedTeam,
    stats,
    roster: normalizedRoster,
    scoreMembers: normalizedScoreMembers,
    albums: normalizedAlbums,
    dailyScores: sortedScores.map((round) => ({
      date: round.date,
      rows: round.rows.map(createRawScoreRow),
    })),
    weekendScores: Array.isArray(weekendScores) ? weekendScores : [],
    memberAliases: (Array.isArray(memberAliases) ? memberAliases : []).filter((alias) => normalizedRoster.some((member) => member.id === alias.memberId)),
    news: normalizedNews,
    newsCategories: normalizedNewsCategories,
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
  const { totals, dailyDetail, weekMembers } = projectScores({
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
  const leaderboardIds = new Set((config.scoreMembers || []).map((member) => member.id));
  for (const id of totals.keys()) {
    if (!leaderboardIds.has(id)) leaderboardIds.add(id);
  }
  const leaderboard = [...leaderboardIds]
    .map((id) => ({
      id,
      name: scoreMembersById.get(id)?.name || '',
      points: totals.get(id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.points - left.points || left.name.localeCompare(right.name),
    )
    .map((row, index) => ({
      id: row.id,
      rank: index + 1,
      name: row.name,
      points: row.points,
    }));
  return {
    ...config,
    roster,
    featuredMembers: roster.slice(0, 8),
    gallery: config.albums
      .filter((album) => !album.password)
      .flatMap((album) => album.photos),
    leaderboard,
    latestScoreDate: latestDate,
    dailyScores,
  };
}

export function parseNewsDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value
    .trim()
    .replace(/[./年月]/g, '-')
    .replace(/日/g, '')
    .split('-')
    .filter((part) => part.length > 0)
    .map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function sortNewsByDateDesc(news) {
  return [...news].sort((left, right) => {
    const leftTime = parseNewsDate(left.date);
    const rightTime = parseNewsDate(right.date);
    if (leftTime !== null && rightTime !== null) return rightTime - leftTime;
    if (leftTime !== null) return -1;
    if (rightTime !== null) return 1;
    return 0;
  });
}

export function getHomeNews(news, { pinnedLimit = 5, fallbackLimit = 3 } = {}) {
  const list = Array.isArray(news) ? news : [];
  const pinned = list.filter((item) => item.pinned).slice(0, pinnedLimit);
  if (pinned.length > 0) return pinned;
  return sortNewsByDateDesc(list).slice(0, fallbackLimit);
}
