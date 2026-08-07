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
  async function previewBatch(batchId) {
    const batch = await store.readBatch(batchId);
    const config = await configStore.read();
    const observations = [];
    const fingerprints = [];
    const imageDuplicates = [];
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

        observations.push({
          imageIndex,
          matches: await ai.extractMatches({
            imageBytes,
            mimeType: image.mimeType,
            multiMatch: batch.multiMatch === true,
          }),
        });
      } catch (error) {
        throw Object.assign(
          new Error(`第 ${imageIndex + 1} 张截图识别失败：${error.message}`),
          { statusCode: error.statusCode || 422 },
        );
      }
    }

    // 重新识别必须保留已有 reviews（人工确认的成员匹配/名次），否则重处理会清空审核记录
    const reviews = { ...(batch.reviews || {}) };
    const imageReviews = { ...(batch.imageReviews || {}) };
    const nextBatch = { ...batch, images, observations, reviews, imageDuplicates, imageReviews };
    const draft = buildDraft({ batch: nextBatch, config });
    await store.updateBatch(batchId, {
      status: 'ready', images, observations, reviews, imageDuplicates, imageReviews, draft,
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

  return { previewBatch, reviewBatch, rematchBatch, commitBatch };
}
