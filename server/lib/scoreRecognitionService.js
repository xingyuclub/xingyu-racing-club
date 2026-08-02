import {
  assignMemberSlots,
  buildDuplicateSignature,
  buildMemberMatcher,
  buildScoreMemberMatcher,
  createScoreMemberId,
  scoreRankedRace,
  scoreTeamRace,
} from '../../src/data/scoreRules.js';

const classifyType = (title) => (String(title || '').includes('排位赛') ? 'ranked' : 'team');
const EMPTY_RACES = () => ({ teamRace: [0, 0, 0], openRace: [0, 0, 0] });

function computeRosterVersion({ roster, memberAliases }) {
  const members = roster.map((m) => `${m.id}:${m.name}`).sort();
  const aliases = (memberAliases || []).map((a) => `${a.memberId}:${a.value}`).sort();
  return members.concat(aliases).join('|');
}

// 把单场比赛的参与者拆成车队成员 + 不可匹配昵称，并计算得分。
function buildRace(match, rosterMatcher, rosterById, scoreMatcher) {
  const type = classifyType(match.title);
  const matched = [];
  const unmatched = [];

  for (const participant of match.participants) {
    const rosterId = rosterMatcher(participant.nickname);
    const rosterMember = rosterById.get(rosterId);
    if (rosterMember) {
      matched.push({
        id: scoreMatcher(rosterMember.name) || createScoreMemberId(rosterMember.name),
        name: rosterMember.name,
        nickname: participant.nickname,
        rank: participant.rank,
      });
    } else {
      unmatched.push(participant.nickname);
    }
  }

  let scored = matched;
  if (type === 'team') {
    const participantCount = match.participants.length;
    scored = matched.map((member) => ({ ...member, score: scoreTeamRace({ participantCount, rank: member.rank }) }));
  } else {
    const scores = scoreRankedRace({ teamRanks: matched.map((member) => member.rank) });
    scored = matched.map((member, index) => ({ ...member, score: scores[index] }));
  }

  return { type, title: match.title, date: match.date, time: match.time, members: scored, unmatched };
}

export function createScoreRecognitionService({ ai, store, configStore }) {
  async function previewBatch(batchId) {
    const batch = await store.readBatch(batchId);
    const config = await configStore.read();
    const rosterMatcher = buildMemberMatcher(config.roster, config.memberAliases || []);
    const rosterById = new Map(config.roster.map((member) => [member.id, member]));
    const scoreMatcher = buildScoreMemberMatcher(config.scoreMembers);
    const rosterVersion = computeRosterVersion(config);

    // 按上传顺序提取每张截图的比赛，展平成单场列表。
    const allMatches = [];
    for (const image of batch.images) {
      const matches = await ai.extractMatches({
        imageBytes: await import('node:fs/promises').then((fs) => fs.readFile(image.path)),
        mimeType: image.mimeType,
        rosterHints: config.roster.map((member) => member.name),
      });
      allMatches.push(...matches);
    }

    const seenSignatures = new Set();
    const races = allMatches.map((match) => {
      const race = buildRace(match, rosterMatcher, rosterById, scoreMatcher);
      const signature = buildDuplicateSignature({
        date: match.date,
        type: race.type,
        participants: match.participants,
      });
      race.duplicate = seenSignatures.has(signature);
      if (!race.duplicate) seenSignatures.add(signature);
      return race;
    });

    // 为每名成员分配当天该类型的局次槽位。
    const existingForDate = config.dailyScores.find((round) => round.date === batch.date)?.rows || [];
    const byType = { team: [], ranked: [] };
    races.forEach((race, index) => {
      if (race.duplicate || race.members.length === 0) return;
      byType[race.type].push({ index, members: race.members });
    });

    for (const type of ['team', 'ranked']) {
      if (!byType[type].length) continue;
      const slotted = assignMemberSlots({ rows: byType[type], existingRows: existingForDate, type });
      slotted.forEach((entry, slotIndex) => {
        const race = races[byType[type][slotIndex].index];
        race.members = entry.members;
      });
    }

    const draft = { races, rosterVersion, batchDate: batch.date };
    await store.updateBatch(batchId, { status: 'ready', draft });
    return draft;
  }

  async function commitBatch(batchId, expectedRosterVersion) {
    const batch = await store.readBatch(batchId);
    const config = await configStore.read();
    const currentVersion = computeRosterVersion(config);
    if (currentVersion !== expectedRosterVersion) {
      throw new Error('成员名单在识别后发生变化，请重新确认匹配后再提交');
    }

    const draft = batch.draft;
    if (!draft) throw new Error('批次尚未生成预览');

    const next = structuredClone(config);
    if (!Array.isArray(next.scoreMembers)) next.scoreMembers = [];
    const scoreMemberIds = new Set(next.scoreMembers.map((member) => member.id));
    let round = next.dailyScores.find((entry) => entry.date === draft.batchDate);
    if (!round) {
      round = { date: draft.batchDate, rows: [] };
      next.dailyScores.push(round);
    }

    for (const race of draft.races) {
      if (race.duplicate) continue;
      const field = race.type === 'ranked' ? 'openRace' : 'teamRace';
      for (const member of race.members) {
        if (member.skipped || member.slot === undefined) continue;
        if (!scoreMemberIds.has(member.id)) {
          next.scoreMembers.push({
            id: member.id,
            name: member.name,
            basePoints: 0,
            wins: 0,
          });
          scoreMemberIds.add(member.id);
        }
        let row = round.rows.find((entry) => entry.id === member.id);
        if (!row) {
          row = { id: member.id, ...EMPTY_RACES() };
          round.rows.push(row);
        }
        if (!Array.isArray(row[field]) || row[field].length !== 3) row[field] = [0, 0, 0];
        row[field][member.slot] = member.score;
      }
    }

    next.dailyScores.sort((left, right) => left.date.localeCompare(right.date));
    await configStore.write(next);
    await store.updateBatch(batchId, { status: 'committed', draft });
    return { committed: true };
  }

  return { previewBatch, commitBatch };
}
