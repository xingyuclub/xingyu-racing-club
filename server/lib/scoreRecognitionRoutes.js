import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';
import { createScoreRecognitionAi } from './scoreRecognitionAi.js';
import { createScoreRecognitionService } from './scoreRecognitionService.js';

const SCORE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const SCORE_RACE_TYPES = new Set(['team', 'ranked']);
const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;
const SCREENSHOT_MAX_FILES = 20;

function screenshotUploadError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function mapScreenshotUploadError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return screenshotUploadError(`截图大小不能超过 ${SCREENSHOT_MAX_BYTES / 1024 / 1024}MB`);
  }
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    return screenshotUploadError(`一次最多上传 ${SCREENSHOT_MAX_FILES} 张截图`);
  }
  return screenshotUploadError('上传文件不符合要求，请通过“上传截图”选择 JPG/PNG 图片');
}

export function createScoreRecognitionRouter({
  configStore,
  dataDir,
  storageDir,
  aiClient,
  model,
  onConfigUpdate,
  fileSystem,
}) {
  const recognitionStore = createScoreRecognitionStore({ dataDir, storageDir, fileSystem });
  const screenshotUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: SCREENSHOT_MAX_BYTES },
    fileFilter(_request, file, callback) {
      if (!SCORE_IMAGE_TYPES.has(file.mimetype)) {
        callback(Object.assign(new Error('截图仅支持 JPG 或 PNG'), { statusCode: 400 }));
        return;
      }
      callback(null, true);
    },
  });

  function getAi() {
    const client = typeof aiClient === 'function' ? aiClient() : aiClient;
    if (!client) throw Object.assign(new Error('未配置 OPENAI_API_KEY，无法识别截图'), { statusCode: 503 });
    return createScoreRecognitionAi({ client, model });
  }

  function getService() {
    return createScoreRecognitionService({ ai: getAi(), store: recognitionStore, configStore });
  }

  const router = Router();

  router.post('/batches', (request, response, next) => {
    screenshotUpload.array('files', SCREENSHOT_MAX_FILES)(request, response, async (error) => {
      if (error) {
        next(mapScreenshotUploadError(error));
        return;
      }
      try {
        const date = request.body?.date;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return response.status(400).json({ error: '必须提供有效的批次日期' });
        }
        const raceType = request.body?.raceType;
        if (!SCORE_RACE_TYPES.has(raceType)) {
          return response.status(400).json({ error: '请选择队内赛或排位赛' });
        }
        const multiMatch = request.body?.multiMatch === 'true' || request.body?.multiMatch === true;
        const files = (request.files || []).map((file) => ({
          name: file.originalname,
          bytes: file.buffer,
          mimeType: file.mimetype,
        }));
        const batch = await recognitionStore.createBatch({ id: randomUUID(), date, raceType, multiMatch, files });
        response.status(201).json(batch);
      } catch (nextError) { next(nextError); }
    });
  });

  router.get('/batches', async (_request, response, next) => {
    try { response.json(await recognitionStore.listBatches()); }
    catch (error) { next(error); }
  });

  router.get('/batches/:id', async (request, response, next) => {
    try { response.json(await recognitionStore.readBatch(request.params.id)); }
    catch (error) {
      if (error.message.includes('not found')) return response.status(404).json({ error: '批次不存在' });
      next(error);
    }
  });

  router.get('/batches/:id/images/:index', async (request, response, next) => {
    try {
      const image = await recognitionStore.readImage(request.params.id, Number(request.params.index));
      response.type(image.mimeType).send(image.bytes);
    } catch (error) {
      if (error.message.includes('not found')) return response.status(404).json({ error: '截图不存在' });
      next(error);
    }
  });

  router.post('/batches/:id/process', async (request, response, next) => {
    try {
      await recognitionStore.updateBatch(request.params.id, { status: 'processing' });
      const draft = await getService().previewBatch(request.params.id);
      response.json(draft);
    } catch (error) {
      await recognitionStore.updateBatch(request.params.id, {
        status: 'failed',
        error: error.message,
      }).catch(() => {});
      response.status(error.statusCode || 422).json({ error: error.message });
    }
  });

  router.put('/batches/:id/review', async (request, response, next) => {
    try {
      const { evidenceId, rank, memberId, ignored, duplicate, notDuplicate } = request.body || {};
      if (typeof evidenceId !== 'string' || !evidenceId) {
        return response.status(400).json({ error: '缺少证据 ID' });
      }
      if (rank !== undefined && (!Number.isInteger(rank) || rank < 1)) {
        return response.status(400).json({ error: '名次必须是正整数' });
      }
      if (memberId !== undefined && (typeof memberId !== 'string' || !memberId)) {
        return response.status(400).json({ error: '成员 ID 无效' });
      }
      if (ignored !== undefined && typeof ignored !== 'boolean') {
        return response.status(400).json({ error: '忽略状态无效' });
      }
      if ((duplicate !== undefined && typeof duplicate !== 'boolean')
        || (notDuplicate !== undefined && typeof notDuplicate !== 'boolean')) {
        return response.status(400).json({ error: '重复判定无效' });
      }
      response.json(await getService().reviewBatch(request.params.id, {
        evidenceId,
        rank,
        memberId,
        ignored,
        duplicate,
        notDuplicate,
      }));
    } catch (error) { next(error); }
  });

  router.post('/batches/:id/commit', async (request, response, next) => {
    try {
      const expectedVersion = request.body?.rosterVersion;
      await getService().commitBatch(request.params.id, expectedVersion);
      if (onConfigUpdate) onConfigUpdate();
      const config = await configStore.read();
      response.json({ committed: true, config });
    } catch (error) {
      if (error.statusCode) return response.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.post('/batches/:id/rematch', async (request, response, next) => {
    try {
      response.json(await getService().rematchBatch(request.params.id));
    } catch (error) {
      if (error.statusCode) return response.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  });

  router.post('/batches/:id/retry', async (request, response, next) => {
    try {
      const retried = await recognitionStore.retryBatch(request.params.id);
      response.json(retried);
    } catch (error) { next(error); }
  });

  return router;
}
