// 确定性计分、身份归一化、去重和局次分配的纯函数。
// 所有业务判断都在这里完成；AI 只负责提取截图事实。

const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const TEAM_PREFIX = /^ˣʸ༩·/;
const MAX_GAMES_PER_TYPE = 3;
const MAX_TEAM_RACE_SCORE = 6;

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
  for (const member of roster) {
    lookup.set(normalizeNickname(member.name), member.id);
  }
  for (const alias of aliases) {
    lookup.set(normalizeNickname(alias.value), alias.memberId);
  }
  return (nickname) => lookup.get(normalizeNickname(nickname)) ?? null;
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

export function buildDuplicateSignature({ date, type, participants }) {
  const entries = participants
    .map((participant) => `${normalizeNickname(participant.nickname)}:${participant.rank}`)
    .sort()
    .join('|');
  return `${date}::${type}::${entries}`;
}

// 为每个成员独立分配当天该类型的局次槽位；已满 3 局的成员标记跳过。
export function assignMemberSlots({ rows, existingRows = [], type }) {
  const field = type === 'ranked' ? 'openRace' : 'teamRace';
  const used = new Map();
  for (const row of existingRows) {
    used.set(row.id, (row[field] || []).length);
  }

  return rows.map((race) => ({
    ...race,
    members: race.members.map((member) => {
      const count = used.get(member.id) || 0;
      if (count >= MAX_GAMES_PER_TYPE) {
        return { ...member, skipped: 'member-limit' };
      }
      const slot = count;
      used.set(member.id, count + 1);
      return { ...member, slot };
    }),
  }));
}
