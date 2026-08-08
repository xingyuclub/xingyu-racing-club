import { readFile } from 'node:fs/promises';
import { invalidateFollowingWeekTotals } from '../../src/data/scoreRules.js';
import { buildRecognitionDraft } from './scoreRecognitionDraft.js';
import {
  buildImageFingerprint,
  compareImageFingerprints,
} from './scoreRecognitionFingerprint.js';

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

function mapNameOf(observation) {
  const mapName = observation?.matches?.[0]?.mapName;
  if (typeof mapName !== 'string') return '';
  return mapName.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').trim();
}

function buildTeamLabels(config) {
  const teamName = typeof config.team?.name === 'string'
    ? config.team.name.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gi, '').trim()
    : '';
  if (!teamName) return [];
  return [...new Set([teamName, teamName.replace(/车队$/, '').trim()].filter(Boolean))];
}

function buildDraft({ batch, config }) {
  const imageReviews = batch.imageReviews || {};
  const duplicateImages = batch.imageDuplicates || [];
  const excludedImages = new Set();
  const unresolved = [];
  let duplicateImageCount = 0;
  let autoDistinctImageCount = 0;

  for (const duplicate of duplicateImages) {
    const review = imageReviews[duplicate.imageIndex] || {};
    if (duplicate.kind === 'exact' || review.duplicate === true) {
      excludedImages.add(duplicate.imageIndex);
      duplicateImageCount += 1;
    } else if (review.notDuplicate === true) {
      // 人工已确认是不同图片
    } else {
      const earlierMap = mapNameOf(batch.observations?.[duplicate.duplicateOfImageIndex]);
      const currentMap = mapNameOf(batch.observations?.[duplicate.imageIndex]);
      if (earlierMap && currentMap && earlierMap !== currentMap) {
        // 两张疑似图片的地图不同：自动判定为不同比赛，直接放行
        autoDistinctImageCount += 1;
      } else {
        unresolved.push(duplicate);
      }
    }
  }

  const draft = buildRecognitionDraft({
    batch,
    observations: (batch.observations || [])
      .filter((observation) => !excludedImages.has(observation.imageIndex)),
    manualEntries: (batch.manualEntries || [])
      .filter((entry) => !excludedImages.has(entry.imageIndex)),
    reviews: batch.reviews || {},
    config,
  });
  const imageIssues = unresolved.map((duplicate) => ({
    code: 'suspected-duplicate-image',
    imageIndex: duplicate.imageIndex,
    duplicateOfImageIndex: duplicate.duplicateOfImageIndex,
  }));

  return {
    ...draft,
    issues: [...draft.issues, ...imageIssues],
    canCommit: draft.canCommit && imageIssues.length === 0,
    duplicateImageCount,
    autoDistinctImageCount,
    suspectedDuplicateImageCount: unresolved.length,
    duplicateImages,
  };
}

export function createScoreRecognitionService({
  ai,
  store,
  configStore,
  fingerprintImage = buildImageFingerprint,
  compareFingerprints = compareImageFingerprints,
}) {
  function raceOf(batch, imageIndex, matchIndex) {
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || !batch.images?.[imageIndex]) {
      throw badRequest('截图序号无效');
    }
    const observation = (batch.observations || []).find((item) => item.imageIndex === imageIndex);
    const match = observation?.matches?.[matchIndex];
    if (!Number.isInteger(matchIndex) || matchIndex < 0 || !match) {
      throw badRequest('比赛场次不存在，请先完成截图识别');
    }
    return match;
  }

  function nextManualId(entries) {
    let sequence = 1;
    const used = new Set(entries.map((entry) => entry.id));
    while (used.has(`manual-${sequence}`)) sequence += 1;
    return `manual-${sequence}`;
  }

  async function extractImage({ batch, config, imageIndex }) {
    const image = batch.images[imageIndex];
    try {
      const imageBytes = await readFile(image.path);
      const teamLabels = buildTeamLabels(config);
      const matches = await ai.extractMatches({
        imageBytes,
        mimeType: image.mimeType,
        multiMatch: batch.multiMatch === true,
        ...(teamLabels.length > 0 ? { teamLabels } : {}),
      });
      return { imageBytes, matches };
    } catch (error) {
      throw Object.assign(
        new Error(`第 ${imageIndex + 1} 张截图识别失败：${error.message}`),
        { statusCode: error.statusCode || 422 },
      );
    }
  }

  async function previewBatch(batchId) {
    const batch = await store.readBatch(batchId);
    const config = await configStore.read();
    const observations = [];
    const fingerprints = [];
    const imageDuplicates = [];
    const imageErrors = [];
    const images = batch.images.map((image) => ({ ...image }));

    for (let imageIndex = 0; imageIndex < batch.images.length; imageIndex += 1) {
      const image = batch.images[imageIndex];
      try {
        const imageBytes = await readFile(image.path);
        const fingerprint = await fingerprintImage(imageBytes);
        fingerprints.push(fingerprint);
        images[imageIndex].fingerprint = fingerprint;

        let duplicate = null;
        for (let earlierIndex = 0; earlierIndex < imageIndex; earlierIndex += 1) {
          const kind = compareFingerprints(fingerprints[earlierIndex], fingerprint);
          if (kind === 'exact') {
            duplicate = { imageIndex, duplicateOfImageIndex: earlierIndex, kind };
            break;
          }
          if (kind === 'suspected' && duplicate === null) {
            duplicate = { imageIndex, duplicateOfImageIndex: earlierIndex, kind };
          }
        }
        if (duplicate) imageDuplicates.push(duplicate);
        if (duplicate?.kind === 'exact') continue;

        const teamLabels = buildTeamLabels(config);
        observations.push({
          imageIndex,
          matches: await ai.extractMatches({
            imageBytes,
            mimeType: image.mimeType,
            multiMatch: batch.multiMatch === true,
            ...(teamLabels.length > 0 ? { teamLabels } : {}),
          }),
        });
      } catch (error) {
        imageErrors.push({ imageIndex, message: error.message });
        continue;
      }
    }
    if (observations.length === 0 && imageErrors.length > 0) {
      const detail = imageErrors.map((item) => `第 ${item.imageIndex + 1} 张：${item.message}`).join("\uFF1B");
      throw Object.assign(new Error(`全部截图识别失败：${detail}`), { statusCode: 422 });
    }

    const reviews = { ...(batch.reviews || {}) };
    const imageReviews = { ...(batch.imageReviews || {}) };
    const nextBatch = { ...batch, images, observations, reviews, imageDuplicates, imageErrors, imageReviews };
    const draft = buildDraft({ batch: nextBatch, config });
    await store.updateBatch(batchId, {
      status: 'ready', images, observations, reviews, imageDuplicates, imageErrors, imageReviews, draft,
    });
    return { ...draft, imageErrors };
  }

  async function reprocessImage(batchId, imageIndex) {
    const batch = await store.readBatch(batchId);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || !batch.images?.[imageIndex]) {
      throw badRequest('截图序号无效');
    }
    const config = await configStore.read();
    const { imageBytes, matches } = await extractImage({ batch, config, imageIndex });
    const observations = [
      ...(batch.observations || []).filter((observation) => observation.imageIndex !== imageIndex),
      { imageIndex, matches },
    ].sort((left, right) => left.imageIndex - right.imageIndex);
    const reviews = Object.fromEntries(
      Object.entries(batch.reviews || {})
        .filter(([id]) => !id.startsWith(`i${imageIndex}-`)),
    );
    const manualEntries = (batch.manualEntries || [])
      .filter((entry) => entry.imageIndex !== imageIndex);
    const nextBatch = { ...batch, observations, reviews, manualEntries };
    const draft = buildDraft({ batch: nextBatch, config });
    await store.updateBatch(batchId, {
      status: 'ready',
      observations,
      reviews,
      manualEntries,
      draft,
      error: undefined,
    });
    return draft;
  }

  async function reviewBatch(batchId, change) {
    const batch = await store.readBatch(batchId);
    if (Number.isInteger(change.imageIndex)) {
      const duplicate = (batch.imageDuplicates || [])
        .find((item) => item.imageIndex === change.imageIndex && item.kind === 'suspected');
      if (!duplicate) throw badRequest('疑似重复图片不存在');
      const config = await configStore.read();
      const imageReviews = { ...(batch.imageReviews || {}) };
      imageReviews[change.imageIndex] = {
        duplicate: change.duplicate === true,
        notDuplicate: change.notDuplicate === true,
      };
      const nextBatch = { ...batch, imageReviews };
      const draft = buildDraft({ batch: nextBatch, config });
      await store.updateBatch(batchId, { imageReviews, draft });
      return draft;
    }
    if (!evidenceIds(batch.observations).has(change.evidenceId)) {
      throw badRequest('证据 ID 不存在');
    }

    const config = await configStore.read();
    if (change.memberId !== undefined
      && !(config.roster || []).some((member) => member.id === change.memberId)) {
      throw badRequest('所选成员不存在');
    }
    if (change.scoreMemberId !== undefined
      && !(config.scoreMembers || []).some((member) => member.id === change.scoreMemberId)) {
      throw badRequest('所选积分人物不存在');
    }

    const reviews = { ...(batch.reviews || {}) };
    reviews[change.evidenceId] = {
      ...(reviews[change.evidenceId] || {}),
      ...(change.rank === undefined ? {} : { rank: change.rank }),
      ...(change.memberId === undefined ? {} : { memberId: change.memberId }),
      ...(change.scoreMemberId === undefined ? {} : { scoreMemberId: change.scoreMemberId }),
      ...(change.ignored === undefined ? {} : { ignored: change.ignored }),
    };
    if (change.duplicate !== undefined || change.notDuplicate !== undefined) {
      reviews[change.evidenceId].duplicate = change.duplicate === true;
      reviews[change.evidenceId].notDuplicate = change.notDuplicate === true;
    }
    const draft = buildDraft({ batch: { ...batch, reviews }, config });
    await store.updateBatch(batchId, { reviews, draft });
    return draft;
  }

  async function rematchBatch(batchId) {
    const batch = await store.readBatch(batchId);
    if (!batch.observations || batch.observations.length === 0) {
      throw Object.assign(new Error('该批次还没有识别结果，请先执行识别'), { statusCode: 400 });
    }
    const config = await configStore.read();
    const draft = buildDraft({ batch, config });
    await store.updateBatch(batchId, { status: 'ready', draft, error: undefined });
    return draft;
  }

  async function addManualParticipant(batchId, input) {
    const batch = await store.readBatch(batchId);
    const imageIndex = input?.imageIndex;
    const matchIndex = input?.matchIndex;
    const match = raceOf(batch, imageIndex, matchIndex);
    const nickname = typeof input?.nickname === 'string' ? input.nickname.trim() : '';
    if (!nickname) throw badRequest('请填写人工补录昵称');
    const rank = input?.rank;
    if (!Number.isInteger(rank) || rank < 1) throw badRequest('名次必须是正整数');
    const existingRanks = (match.participants || [])
      .map((participant) => participant.rank)
      .concat((batch.manualEntries || [])
        .filter((entry) => entry.imageIndex === imageIndex && entry.matchIndex === matchIndex)
        .map((entry) => entry.rank));
    if (existingRanks.includes(rank)) throw badRequest(`第 ${rank} 名已经存在，不能重复补录`);

    const scoreMemberId = input?.scoreMemberId || undefined;
    const config = await configStore.read();
    if (scoreMemberId && !(config.scoreMembers || []).some((member) => member.id === scoreMemberId)) {
      throw badRequest('所选积分人物不存在');
    }
    const manualEntries = [
      ...(batch.manualEntries || []),
      {
        id: nextManualId(batch.manualEntries || []),
        imageIndex,
        matchIndex,
        nickname,
        rank,
        ...(scoreMemberId ? { scoreMemberId } : {}),
      },
    ];
    const nextBatch = { ...batch, manualEntries };
    const draft = buildDraft({ batch: nextBatch, config });
    await store.updateBatch(batchId, { status: 'ready', manualEntries, draft, error: undefined });
    return draft;
  }

  async function removeManualParticipant(batchId, manualEntryId) {
    const batch = await store.readBatch(batchId);
    const manualEntries = (batch.manualEntries || []).filter((entry) => entry.id !== manualEntryId);
    if (manualEntries.length === (batch.manualEntries || []).length) {
      throw badRequest('人工补录记录不存在');
    }
    const config = await configStore.read();
    const draft = buildDraft({ batch: { ...batch, manualEntries }, config });
    await store.updateBatch(batchId, { status: 'ready', manualEntries, draft, error: undefined });
    return draft;
  }

  async function commitBatch(batchId, expectedRosterVersion) {
    const batch = await store.readBatch(batchId);
    if (!batch.draft?.canCommit) {
      throw Object.assign(new Error('仍有未处理的识别异常，无法提交'), { statusCode: 422 });
    }

    const config = await configStore.read();
    const currentDraft = buildDraft({ batch, config });
    if (currentDraft.rosterVersion !== expectedRosterVersion) {
      throw Object.assign(new Error('成员名单在识别后发生变化，请重新确认匹配后再提交'), { statusCode: 409 });
    }

    const next = structuredClone(config);
    let round = next.dailyScores.find((entry) => entry.date === batch.date);
    if (!round) {
      round = { date: batch.date, rows: [] };
      next.dailyScores.push(round);
    }
    const field = batch.raceType === 'ranked' ? 'openRace' : 'teamRace';

    for (const item of currentDraft.evidence) {
      if (item.duplicate || item.ignored || item.warning || item.slot === undefined) continue;
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

  return {
    previewBatch,
    reprocessImage,
    reviewBatch,
    rematchBatch,
    addManualParticipant,
    removeManualParticipant,
    commitBatch,
  };
}
