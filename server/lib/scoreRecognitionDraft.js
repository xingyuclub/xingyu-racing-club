import {
  assignMemberSlots,
  buildDuplicateSignature,
  buildMemberMatcher,
  buildScoreMemberMatcher,
  createScoreMemberId,
  hasRaceDiscriminator,
  scoreRankedRace,
  scoreTeamRace,
} from '../../src/data/scoreRules.js';

function computeRosterVersion(config) {
  const members = (config.roster || []).map((member) => `${member.id}:${member.name}`).sort();
  const aliases = (config.memberAliases || [])
    .map((alias) => `${alias.memberId}:${alias.value}`)
    .sort();
  return members.concat(aliases).join('|');
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
          nickname: participant.nickname,
          rank: Object.hasOwn(review, 'rank') ? review.rank : participant.rank,
          score: participant.score,
          attack: participant.attack,
          defense: participant.defense,
          assist: participant.assist,
          ignored: review.ignored === true,
          reviewedMemberId: Object.hasOwn(review, 'memberId') ? review.memberId : undefined,
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
  const matchRoster = buildMemberMatcher(roster, config.memberAliases || []);
  const matchScoreMember = buildScoreMemberMatcher(config.scoreMembers || []);

  for (const race of races) {
    for (const item of race.evidence) {
      if (item.ignored) continue;
      const memberId = item.reviewedMemberId === undefined
        ? matchRoster(item.nickname)
        : item.reviewedMemberId;
      const member = rosterById.get(memberId);
      if (!member) continue;
      item.memberId = member.id;
      item.memberName = member.name;
      item.scoreMemberId = matchScoreMember(member.name) || createScoreMemberId(member.name);
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
      if (!item.ignored && !item.memberId) {
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
      && item.memberId
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
    const earlier = seen.get(contentSignature);
    if (earlier) {
      const bothDiscriminated = hasRaceDiscriminator(race.evidence)
        && hasRaceDiscriminator(earlier.evidence);
      if (bothDiscriminated && fullSignature === earlier.fullSignature) {
        // 人员、名次、数值列全部一致：确认为同一场，自动跳过
        race.autoDuplicate = true;
      } else if (bothDiscriminated) {
        // 人员名次相同但数值不同：确认为不同场次，自动保留
        race.autoDistinct = true;
      } else {
        // 缺数值列无法自动判断：交给人工确认
        race.suspectedDuplicate = true;
        race.duplicateOf = {
          imageIndex: earlier.evidence[0]?.imageIndex ?? 0,
          matchIndex: earlier.evidence[0]?.matchIndex ?? 0,
        };
      }
    } else {
      seen.set(contentSignature, { evidence: race.evidence, fullSignature });
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
      item.suspectedDuplicate = race.suspectedDuplicate;
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
    evidence: races.flatMap((race) => race.evidence).map(({ reviewedMemberId, ...item }) => item),
    summary: summarize(races),
    duplicateCount: races.filter((race) => race.duplicate).length,
    suspectedDuplicateCount: races.filter((race) => race.suspectedDuplicate).length,
    autoDistinctCount: races.filter((race) => race.autoDistinct).length,
    raceWarnings,
    issues,
    canCommit: issues.length === 0,
  };
}
