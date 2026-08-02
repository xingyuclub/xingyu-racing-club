import * as defaultFileSystem from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const BATCH_STATUSES = new Set(['uploaded', 'processing', 'ready', 'failed', 'committed']);
const VALID_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

export function createScoreRecognitionStore({ dataDir, storageDir, fileSystem: providedFileSystem = {} }) {
  const fs = { ...defaultFileSystem, ...providedFileSystem };
  const indexPath = join(dataDir, 'score-recognition-index.json');
  const temporaryPath = join(dataDir, 'score-recognition-index.json.next');
  let writeQueue = Promise.resolve();

  async function ensureDirs() {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(storageDir, { recursive: true });
  }

  async function readIndex() {
    try {
      return JSON.parse(await fs.readFile(indexPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }

  async function writeIndex(index) {
    await fs.writeFile(temporaryPath, JSON.stringify(index, null, 2));
    await fs.rename(temporaryPath, indexPath);
  }

  function publicBatch(batch) {
    const { rawOutput, ...rest } = batch;
    return rest;
  }

  async function createBatch({ id, date, files = [] }) {
    await ensureDirs();
    const batchId = id ?? randomUUID();
    const batchDir = join(storageDir, batchId);
    await fs.mkdir(batchDir, { recursive: true });

    const images = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!VALID_MIME_TYPES.has(file.mimeType)) {
        throw new Error('unsupported file type: ' + file.mimeType);
      }
      const extension = file.mimeType === 'image/png' ? 'png' : 'jpg';
      const filename = `${String(index + 1).padStart(2, '0')}.${extension}`;
      const filePath = join(batchDir, filename);
      await fs.writeFile(filePath, file.bytes);
      images.push({ originalName: file.name, path: filePath, mimeType: file.mimeType });
    }

    const now = new Date().toISOString();
    const batch = {
      id: batchId,
      date,
      status: 'uploaded',
      images,
      createdAt: now,
      updatedAt: now,
    };

    const operation = writeQueue.then(async () => {
      const index = await readIndex();
      index[batchId] = batch;
      await writeIndex(index);
      return publicBatch(batch);
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function readBatch(batchId) {
    const index = await readIndex();
    const batch = index[batchId];
    if (!batch) throw new Error('batch not found: ' + batchId);
    return publicBatch(batch);
  }

  async function updateBatch(batchId, patch) {
    const index = await readIndex();
    const batch = index[batchId];
    if (!batch) throw new Error('batch not found: ' + batchId);
    if (patch.status && !BATCH_STATUSES.has(patch.status)) {
      throw new Error('invalid batch status: ' + patch.status);
    }
    const updated = {
      ...batch,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const operation = writeQueue.then(async () => {
      const fresh = await readIndex();
      const current = fresh[batchId];
      if (!current) throw new Error('batch not found: ' + batchId);
      const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
      fresh[batchId] = merged;
      await writeIndex(fresh);
      return publicBatch(merged);
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  async function listBatches() {
    const index = await readIndex();
    return Object.values(index)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(publicBatch);
  }

  async function retryBatch(batchId) {
    return updateBatch(batchId, { status: 'uploaded', error: undefined, draft: undefined });
  }

  return { createBatch, readBatch, updateBatch, listBatches, retryBatch };
}
