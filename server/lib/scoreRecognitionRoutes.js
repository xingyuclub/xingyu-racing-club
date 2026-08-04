import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';
import { createScoreRecognitionAi } from './scoreRecognitionAi.js';
import { createScoreRecognitionService } from './scoreRecognitionService.js';

const SCORE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const SCORE_RACE_TYPES = new Set(['team', 'ranked']);

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
    limits: { fileSize: 10 * 1024 * 1024 },
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
    screenshotUpload.array('files', 20)(request, response, async (error) => {
      if (error) return next(error);
      try {
        const date = request.body?.date;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return response.status(400).json({ error: '必须提供有效的批次日期' });
        }
        const raceType = request.body?.raceType;
        if (!SCORE_RACE_TYPES.has(raceType)) {
          return response.status(400).json({ error: '请选择队内赛或排位赛' });
        }
        const files = (request.files || []).map((file) => ({
          name: file.originalname,
          bytes: file.buffer,
          mimeType: file.mimetype,
        }));
        const batch = await recognitionStore.createBatch({ id: randomUUID(), date, raceType, files });
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

  router.post('/batches/:id/process', async (request, response, next) => {
    try {
      await recognitionStore.updateBatch(request.params.id, { status: 'processing' });
      const draft = await getService().previewBatch(request.params.id);
      response.json(draft);
    } catch (error) { next(error); }
  });

  router.put('/batches/:id/draft', async (request, response, next) => {
    try {
      const updated = await recognitionStore.updateBatch(request.params.id, { draft: request.body });
      response.json(updated);
    } catch (error) { next(error); }
  });

  router.post('/batches/:id/commit', async (request, response, next) => {
    try {
      const expectedVersion = request.body?.rosterVersion;
      await getService().commitBatch(request.params.id, expectedVersion);
      if (onConfigUpdate) onConfigUpdate();
      const config = await configStore.read();
      response.json({ committed: true, config });
    } catch (error) { next(error); }
  });

  router.post('/batches/:id/retry', async (request, response, next) => {
    try {
      const retried = await recognitionStore.retryBatch(request.params.id);
      response.json(retried);
    } catch (error) { next(error); }
  });

  return router;
}
