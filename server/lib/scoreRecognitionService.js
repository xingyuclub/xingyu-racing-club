import { readFile } from 'node:fs/promises';
import { invalidateFollowingWeekTotals } from '../../src/data/scoreRules.js';
import { buildRecognitionDraft } from './scoreRecognitionDraft.js';

const EMPTY_RACES = () => ({ teamRace: [null, null, null], openRace: [null, null, null] });

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function evidenceIds(observations = []) {
  return new Set(observations.flatMap((observation, observationIndex) => {
    const imageIndex = observation.imageIndex ?? observationIndex;
    return (observation.matches || []).flatMap((match, matchIndex) => (
      (match.participants || []).map((_, participantIndex) => (
        `i${imageIndex}-m${matchIndex}-p${participantIndex}`
      ))
    ));
  }));
}

export function createScoreRecognitionService({ ai, store, configStore }) {
  async function previewBatch(batchId) {
    const batch = await store.readBatch(batchId);
    const config = await configStore.read();
    const observations = [];

    for (let imageIndex = 0; imageIndex < batch.images.length; imageIndex += 1) {
      const image = batch.images[imageIndex];
      try {
        observations.push({
          imageIndex,
          matches: await ai.extractMatches({
            imageBytes: await readFile(image.path),
            mimeType: image.mimeType,
          }),
        });
      } catch (error) {
        throw Object.assign(
          new Error(`第 ${imageIndex + 1} 张截图识别失败：${error.message}`),
          { statusCode: error.statusCode || 422 },
        );
      }
    }

    const reviews = {};
    const draft = buildRecognitionDraft({ batch, observations, reviews, config });
    await store.updateBatch(batchId, { status: 'ready', observations, reviews, draft });
    return draft;
  }

  async function reviewBatch(batchId, change) {
    const batch = await store.readBatch(batchId);
    if (!evidenceIds(batch.observations).has(change.evidenceId)) {
      throw badRequest('证据 ID 不存在');
    }

    const config = await configStore.read();
    if (change.memberId !== undefined
      && !(config.roster || []).some((member) => member.id === change.memberId)) {
      throw badRequest('所选成员不存在');
    }

    const reviews = { ...(batch.reviews || {}) };
    reviews[change.evidenceId] = {
      ...(reviews[change.evidenceId] || {}),
      ...(change.rank === undefined ? {} : { rank: change.rank }),
      ...(change.memberId === undefined ? {} : { memberId: change.memberId }),
      ...(change.ignored === undefined ? {} : { ignored: change.ignored }),
    };
    const draft = buildRecognitionDraft({ batch, observations: batch.observations, reviews, config });
    await store.updateBatch(batchId, { reviews, draft });
    return draft;
  }

  async function commitBatch(batchId, expectedRosterVersion) {
    const batch = await store.readBatch(batchId);
    if (!batch.draft?.canCommit) {
      throw Object.assign(new Error('仍有未处理的识别异常，无法提交'), { statusCode: 422 });
    }

    const config = await configStore.read();
    const currentDraft = buildRecognitionDraft({
      batch,
      observations: batch.observations,
      reviews: batch.reviews,
      config,
    });
    if (currentDraft.rosterVersion !== expectedRosterVersion) {
      throw Object.assign(new Error('成员名单在识别后发生变化，请重新确认匹配后再提交'), { statusCode: 409 });
    }

    const next = structuredClone(config);
    if (!Array.isArray(next.scoreMembers)) next.scoreMembers = [];
    const scoreMemberIds = new Set(next.scoreMembers.map((member) => member.id));
    let round = next.dailyScores.find((entry) => entry.date === batch.date);
    if (!round) {
      round = { date: batch.date, rows: [] };
      next.dailyScores.push(round);
    }
    const field = batch.raceType === 'ranked' ? 'openRace' : 'teamRace';

    for (const item of currentDraft.evidence) {
      if (item.duplicate || item.ignored || item.warning || item.slot === undefined) continue;
      if (!scoreMemberIds.has(item.scoreMemberId)) {
        next.scoreMembers.push({
          id: item.scoreMemberId,
          name: item.memberName,
          basePoints: 0,
          wins: 0,
        });
        scoreMemberIds.add(item.scoreMemberId);
      }
      let row = round.rows.find((entry) => entry.id === item.scoreMemberId);
      if (!row) {
        row = { id: item.scoreMemberId, ...EMPTY_RACES() };
        round.rows.push(row);
      }
      if (!Array.isArray(row[field]) || row[field].length !== 3) row[field] = [null, null, null];
      delete row.score;
      delete row.total;
      row[field][item.slot] = item.score;
      invalidateFollowingWeekTotals(next, { date: batch.date, id: item.scoreMemberId });
    }

    next.dailyScores.sort((left, right) => left.date.localeCompare(right.date));
    await configStore.write(next);
    await store.updateBatch(batchId, { status: 'committed', draft: currentDraft });
    return { committed: true };
  }

  return { previewBatch, reviewBatch, commitBatch };
}
