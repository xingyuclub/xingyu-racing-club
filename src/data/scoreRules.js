// 确定性计分、身份归一化、去重和局次分配的纯函数。
// 所有业务判断都在这里完成；AI 只负责提取截图事实。

const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const TEAM_PREFIX = /^(?:ˣʸ༩|xy[^·._\-\s]{0,2})\s*[·._-]\s*/i;
const MAX_GAMES_PER_TYPE = 3;
const MAX_TEAM_RACE_SCORE = 6;
const HAN_CHARACTERS = /\p{Script=Han}/gu;

export function extractHanCharacters(value) {
  return String(value ?? '').normalize('NFC').match(HAN_CHARACTERS)?.join('') ?? '';
}

export function normalizeNickname(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLE_CHARS, '')
    .trim()
    .replace(TEAM_PREFIX, '')
    .toLowerCase();
}

export function createScoreMemberId(name) {
  const normalized = normalizeNickname(name);
  if (!normalized) throw new Error('积分人物名称不能为空');
  return `score:${encodeURIComponent(normalized)}`;
}

export function buildScoreMemberMatcher(scoreMembers = []) {
  const lookup = new Map(
    scoreMembers.map((member) => [normalizeNickname(member.name), member.id]),
  );
  return (name) => lookup.get(normalizeNickname(name)) ?? null;
}

export function buildMemberMatcher(roster, aliases = []) {
  const lookup = new Map();
  const hanLookup = new Map();
  for (const member of roster) {
    const normalizedName = normalizeNickname(member.name);
    lookup.set(normalizedName, member.id);

    const hanName = extractHanCharacters(normalizedName);
    if ([...hanName].length < 2) continue;
    if (!hanLookup.has(hanName)) {
      hanLookup.set(hanName, member.id);
    } else if (hanLookup.get(hanName) !== member.id) {
      hanLookup.set(hanName, null);
    }
  }
  for (const alias of aliases) {
    lookup.set(normalizeNickname(alias.value), alias.memberId);
  }
  return (nickname) => {
    const normalized = normalizeNickname(nickname);
    if (lookup.has(normalized)) return lookup.get(normalized) ?? null;

    const hanName = extractHanCharacters(normalized);
    if ([...hanName].length < 2) return null;
    return hanLookup.get(hanName) ?? null;
  };
}

// 队内赛：所有实际参赛者计入人数，得分 = max(min(人数, 6) - 名次 + 1, 0)
export function scoreTeamRace({ participantCount, rank }) {
  return Math.max(Math.min(participantCount, MAX_TEAM_RACE_SCORE) - rank + 1, 0);
}

// 排位赛：按车队成员游戏名次排序后，按相对名次计分，封顶 3 分。
export function scoreRankedRace({ teamRanks }) {
  const ordered = teamRanks
    .map((rank, index) => ({ rank, index }))
    .sort((left, right) => left.rank - right.rank);
  const cap = Math.min(ordered.length, MAX_GAMES_PER_TYPE);
  const scores = new Array(teamRanks.length).fill(0);
  ordered.forEach((entry, position) => {
    scores[entry.index] = Math.max(cap - position, 0);
  });
  return scores;
}

const DISCRIMINATOR_KEYS = ['score', 'attack', 'defense', 'assist'];

function participantSignature(participant) {
  const parts = [normalizeNickname(participant.nickname), participant.rank];
  for (const key of DISCRIMINATOR_KEYS) {
    if (Number.isFinite(participant[key])) parts.push(`${key}=${participant[key]}`);
  }
  return parts.join(':');
}

// 是否至少有一个玩家带数值列（得分/攻击/防御/援助），有数值才能做自动判重。
export function hasRaceDiscriminator(participants) {
  return (participants || []).some((participant) => (
    DISCRIMINATOR_KEYS.some((key) => Number.isFinite(participant[key]))
  ));
}

export function buildDuplicateSignature({ date, type, participants }) {
  const entries = participants
    .map(participantSignature)
    .sort()
    .join('|');
  return `${date}::${type}::${entries}`;
}

function getWeekStart(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return null;
  const daysSinceMonday = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value.toISOString().slice(0, 10);
}

export function invalidateFollowingWeekTotals(config, { date, id }) {
  const weekStart = getWeekStart(date);
  if (!weekStart || !id) return config;
  for (const collection of [config.dailyScores || [], config.weekendScores || []]) {
    for (const round of collection) {
      if (round.date < date || getWeekStart(round.date) !== weekStart) continue;
      const row = round.rows.find((entry) => entry.id === id);
      if (row) delete row.total;
    }
  }
  return config;
}

// 为每个成员独立分配当天该类型的局次槽位；已满 3 局的成员标记跳过。
export function assignMemberSlots({ rows, existingRows = [], type }) {
  const field = type === 'ranked' ? 'openRace' : 'teamRace';
  const used = new Map();
  for (const row of existingRows) {
    const values = row[field] || [];
    const hasExplicitEmptySlots = values.includes(null);
    used.set(row.id, new Set(values.flatMap((value, index) =>
      (hasExplicitEmptySlots ? value !== null : true) ? [index] : [])));
  }

  return rows.map((race) => ({
    ...race,
    members: race.members.map((member) => {
      const occupied = used.get(member.id) || new Set();
      const slot = Array.from(
        { length: MAX_GAMES_PER_TYPE },
        (_, index) => index,
      ).find((index) => !occupied.has(index));
      if (slot === undefined) {
        return { ...member, skipped: 'member-limit' };
      }
      occupied.add(slot);
      used.set(member.id, occupied);
      return { ...member, slot };
    }),
  }));
}
