import {
  assignMemberSlots,
  buildDuplicateSignature,
  buildMemberMatcher,
  hasRaceDiscriminator,
  scoreRankedRace,
  scoreTeamRace,
} from '../../src/data/scoreRules.js';

function computeRosterVersion(config) {
  const scoreMembers = (config.scoreMembers || [])
    .map((member) => `${member.id}:${member.name}`)
    .sort();
  const roster = (config.roster || [])
    .map((member) => `${member.id}:${member.name}:${member.scoreMemberId || ''}`)
    .sort();
  const aliases = (config.memberAliases || [])
    .map((alias) => `${alias.memberId}:${alias.value}`)
    .sort();
  return scoreMembers.concat(roster, aliases).join('|');
}

function buildRaces(observations, reviews) {
  return observations.flatMap((observation, observationIndex) => {
    const imageIndex = observation.imageIndex ?? observationIndex;
    return (observation.matches || []).map((match, matchIndex) => {
      const evidence = (match.participants || []).map((participant, participantIndex) => {
        const id = `i${imageIndex}-m${matchIndex}-p${participantIndex}`;
        const review = reviews[id] || {};
        return {
          id,
          imageIndex,
          matchIndex,
          participantIndex,
          mapName: match.mapName,
          nickname: participant.nickname,
          rank: Object.hasOwn(review, 'rank') ? review.rank : participant.rank,
          score: participant.score,
          attack: participant.attack,
          defense: participant.defense,
          assist: participant.assist,
          ignored: review.ignored === true,
          reviewedMemberId: Object.hasOwn(review, 'memberId') ? review.memberId : undefined,
          reviewedScoreMemberId: Object.hasOwn(review, 'scoreMemberId')
            ? review.scoreMemberId
            : undefined,
        };
      });
      const raceReview = reviews[evidence[0]?.id] || {};
      return {
        evidence,
        reviewedDuplicate: raceReview.duplicate === true,
        reviewedNotDuplicate: raceReview.notDuplicate === true,
      };
    });
  });
}

function matchMembers(races, config) {
  const roster = config.roster || [];
  const rosterById = new Map(roster.map((member) => [member.id, member]));
  const rosterByScoreMemberId = new Map(
    roster.filter((member) => member.scoreMemberId)
      .map((member) => [member.scoreMemberId, member]),
  );
  const scoreMembers = config.scoreMembers || [];
  const scoreMembersById = new Map(
    scoreMembers.map((member) => [member.id, member]),
  );
  const scoreAliases = (config.memberAliases || []).flatMap((alias) => {
    const scoreMemberId = rosterById.get(alias.memberId)?.scoreMemberId;
    return scoreMemberId ? [{ memberId: scoreMemberId, value: alias.value }] : [];
  });
  const matchScoreMember = buildMemberMatcher(scoreMembers, scoreAliases);

  for (const race of races) {
    for (const item of race.evidence) {
      if (item.ignored) continue;
      const legacyScoreMemberId = item.reviewedMemberId === undefined
        ? undefined
        : rosterById.get(item.reviewedMemberId)?.scoreMemberId;
      const scoreMemberId = item.reviewedScoreMemberId
        ?? legacyScoreMemberId
        ?? matchScoreMember(item.nickname);
      const scoreMember = scoreMembersById.get(scoreMemberId);
      if (!scoreMember) continue;
      const rosterMember = rosterByScoreMemberId.get(scoreMember.id);
      if (rosterMember) item.memberId = rosterMember.id;
      item.memberName = rosterMember?.name || scoreMember.name;
      item.scoreMemberId = scoreMember.id;
    }
  }
}

function validateRaces(races) {
  const issues = [];
  for (const race of races) {
    if (race.duplicate) continue;
    if (race.suspectedDuplicate) {
      issues.push({
        evidenceId: race.evidence[0]?.id,
        code: 'suspected-duplicate',
        imageIndex: race.evidence[0]?.imageIndex ?? 0,
        matchIndex: race.evidence[0]?.matchIndex ?? 0,
        duplicateOf: race.duplicateOf,
      });
    }
    const rankCounts = new Map();
    for (const item of race.evidence) {
      if (Number.isInteger(item.rank) && item.rank > 0) {
        rankCounts.set(item.rank, (rankCounts.get(item.rank) || 0) + 1);
      }
    }

    for (const item of race.evidence) {
      if (item.ignored) continue;
      if (!Number.isInteger(item.rank) || item.rank < 1) {
        issues.push({ evidenceId: item.id, code: 'invalid-rank' });
      } else if (rankCounts.get(item.rank) > 1) {
        issues.push({ evidenceId: item.id, code: 'duplicate-rank' });
      }
      if (!item.ignored && !item.scoreMemberId) {
        issues.push({ evidenceId: item.id, code: 'unmatched' });
      }
    }
  }
  return issues;
}

function scoreRaces(races, raceType) {
  for (const race of races) {
    const members = race.evidence.filter((item) => (
      !item.ignored
      && item.scoreMemberId
      && Number.isInteger(item.rank)
      && item.rank > 0
    ));
    if (raceType === 'ranked') {
      const scores = scoreRankedRace({ teamRanks: members.map((item) => item.rank) });
      members.forEach((item, index) => { item.score = scores[index]; });
    } else {
      const ranks = race.evidence
        .filter((item) => Number.isInteger(item.rank) && item.rank > 0)
        .map((item) => item.rank);
      const participantCount = ranks.length ? Math.max(...ranks) : 0;
      members.forEach((item) => {
        item.score = scoreTeamRace({ participantCount, rank: item.rank });
      });
    }
  }
}

function normalizeMapName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').trim();
}

function markSuspectedDuplicates(races, batch) {
  const seen = new Map();
  for (const race of races) {
    const contentSignature = buildDuplicateSignature({
      date: batch.date,
      type: batch.raceType,
      participants: race.evidence.map((item) => ({ nickname: item.nickname, rank: item.rank })),
    });
    const fullSignature = buildDuplicateSignature({
      date: batch.date,
      type: batch.raceType,
      participants: race.evidence,
    });
    const mapName = normalizeMapName(race.evidence[0]?.mapName);
    const earlierByMap = seen.get(contentSignature);
    const earlier = earlierByMap?.get(mapName);
    if (earlier) {
      const bothHaveMap = mapName !== '' && normalizeMapName(earlier.evidence[0]?.mapName) !== '';
      const bothDiscriminated = hasRaceDiscriminator(race.evidence)
        && hasRaceDiscriminator(earlier.evidence);
      if (!bothHaveMap) {
        // 任一场缺少地图：无法确定比赛身份，转人工确认
        race.suspectedDuplicate = true;
        race.duplicateOf = {
          imageIndex: earlier.evidence[0]?.imageIndex ?? 0,
          matchIndex: earlier.evidence[0]?.matchIndex ?? 0,
        };
      } else if (bothDiscriminated && fullSignature === earlier.fullSignature) {
        // 同地图、人员、名次、数值列全部一致：确认为同一场，自动跳过
        race.autoDuplicate = true;
      } else if (bothDiscriminated) {
        // 同地图、人员名次相同但数值不同：确认为不同场次，自动保留
        race.autoDistinct = true;
      } else {
        // 同地图但缺数值列无法自动判断：交给人工确认
        race.suspectedDuplicate = true;
        race.duplicateOf = {
          imageIndex: earlier.evidence[0]?.imageIndex ?? 0,
          matchIndex: earlier.evidence[0]?.matchIndex ?? 0,
        };
      }
    } else if (earlierByMap && (!mapName || earlierByMap.has(''))) {
      // 任一场无地图，但同批已有相同人员与名次的其他场次：无法确定身份，转人工确认
      const first = earlierByMap.get('') || earlierByMap.values().next().value;
      race.suspectedDuplicate = true;
      race.duplicateOf = {
        imageIndex: first.evidence[0]?.imageIndex ?? 0,
        matchIndex: first.evidence[0]?.matchIndex ?? 0,
      };
    }
    if (!earlierByMap) {
      seen.set(contentSignature, new Map([[mapName, { evidence: race.evidence, fullSignature }]]));
    } else if (!earlierByMap.has(mapName)) {
      earlierByMap.set(mapName, { evidence: race.evidence, fullSignature });
    }
  }
  for (const race of races) {
    race.evidence.forEach((item) => {
      item.suspectedDuplicate = race.suspectedDuplicate === true;
      item.duplicateOf = race.duplicateOf;
      item.autoDuplicate = race.autoDuplicate === true;
      item.autoDistinct = race.autoDistinct === true;
    });
  }
}

function resolveDuplicates(races) {
  for (const race of races) {
    const duplicate = race.reviewedDuplicate
      ? true
      : race.reviewedNotDuplicate
        ? false
        : race.autoDuplicate === true;
    if (duplicate || race.reviewedNotDuplicate) {
      race.suspectedDuplicate = false;
      race.duplicateOf = undefined;
    }
    race.duplicate = duplicate;
    race.evidence.forEach((item) => {
      item.duplicate = race.duplicate;
      item.suspectedDuplicate = race.suspectedDuplicate === true;
      item.duplicateOf = race.duplicateOf;
    });
  }
}

function assignSlots(races, config, batch) {
  const existingRows = (config.dailyScores || [])
    .find((round) => round.date === batch.date)?.rows || [];
  const candidates = races
    .filter((race) => !race.duplicate)
    .map((race) => ({
      members: race.evidence
        .filter((item) => item.scoreMemberId && item.score !== undefined)
        .map((item) => ({ id: item.scoreMemberId, score: item.score, evidence: item })),
    }))
    .filter((entry) => entry.members.length > 0);

  const slotted = assignMemberSlots({
    rows: candidates.map((entry) => ({ members: entry.members })),
    existingRows,
    type: batch.raceType,
  });
  slotted.forEach((race) => {
    race.members.forEach((member) => {
      if (member.skipped) member.evidence.warning = member.skipped;
      else member.evidence.slot = member.slot;
    });
  });
}

function summarize(races) {
  const byMember = new Map();
  for (const item of races.flatMap((race) => race.evidence)) {
    if (item.duplicate || item.ignored || item.slot === undefined) continue;
    let summary = byMember.get(item.scoreMemberId);
    if (!summary) {
      summary = {
        id: item.scoreMemberId,
        name: item.memberName,
        score: 0,
        evidenceIds: [],
      };
      byMember.set(item.scoreMemberId, summary);
    }
    summary.score += item.score;
    summary.evidenceIds.push(item.id);
  }
  return [...byMember.values()].sort((left, right) => (
    right.score - left.score || left.name.localeCompare(right.name, 'zh-CN')
  ));
}

export function buildRecognitionDraft({ batch, observations, reviews = {}, config }) {
  const races = buildRaces(observations || [], reviews);
  matchMembers(races, config);
  markSuspectedDuplicates(races, batch);
  resolveDuplicates(races);
  const issues = validateRaces(races);
  scoreRaces(races, batch.raceType);
  assignSlots(races, config, batch);

  const raceWarnings = [];
  for (const race of races) {
    if (race.duplicate) continue;
    const ranks = race.evidence
      .filter((item) => Number.isInteger(item.rank) && item.rank > 0)
      .map((item) => item.rank);
    if (ranks.length === 0) continue;
    const maxRank = Math.max(...ranks);
    const missing = [];
    for (let rank = 1; rank <= maxRank; rank += 1) {
      if (!ranks.includes(rank)) missing.push(rank);
    }
    if (missing.length > 0) {
      raceWarnings.push({
        imageIndex: race.evidence[0]?.imageIndex ?? 0,
        matchIndex: race.evidence[0]?.matchIndex ?? 0,
        missingRanks: missing,
        maxRank,
      });
    }
  }

  return {
    batchId: batch.id,
    batchDate: batch.date,
    raceType: batch.raceType,
    rosterVersion: computeRosterVersion(config),
    evidence: races.flatMap((race) => race.evidence)
      .map(({ reviewedMemberId, reviewedScoreMemberId, ...item }) => item),
    summary: summarize(races),
    duplicateCount: races.filter((race) => race.duplicate).length,
    suspectedDuplicateCount: races.filter((race) => race.suspectedDuplicate).length,
    autoDistinctCount: races.filter((race) => race.autoDistinct).length,
    raceWarnings,
    issues,
    canCommit: issues.length === 0,
  };
}
