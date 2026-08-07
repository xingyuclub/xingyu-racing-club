// @vitest-environment node

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScoreRecognitionStore } from './scoreRecognitionStore.js';

describe('score recognition store', () => {
  let rootDir;
  let dataDir;
  let storageDir;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'score-recog-'));
    dataDir = join(rootDir, 'data');
    storageDir = join(rootDir, 'storage', 'score-recognition');
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('creates a batch and saves uploaded originals in upload order', async () => {
    const store = createScoreRecognitionStore({ dataDir, storageDir });
    const batch = await store.createBatch({
      id: 'batch-1',
      date: '2026-08-01',
      raceType: 'team',
      files: [
        { name: 'a.jpg', bytes: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' },
        { name: 'b.png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mimeType: 'image/png' },
      ],
    });

    expect(batch.id).toBe('batch-1');
    expect(batch.status).toBe('uploaded');
    expect(batch.date).toBe('2026-08-01');
    expect(batch.raceType).toBe('team');
    expect(batch.images).toHaveLength(2);
    expect(batch.images.map((image) => image.originalName)).toEqual(['a.jpg', 'b.png']);
    expect(batch.images[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(batch.images[0].sha256).not.toBe(batch.images[1].sha256);

    const stored = await store.readBatch('batch-1');
    expect(stored.status).toBe('uploaded');
    expect(stored.raceType).toBe('team');

    const all = await store.listBatches();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('batch-1');
    expect(all[0].raceType).toBe('team');
  });

  it('persists original image bytes to the batch storage directory', async () => {
    const store = createScoreRecognitionStore({ dataDir, storageDir });
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    await store.createBatch({
      id: 'batch-2',
      date: '2026-08-01',
      raceType: 'team',
      files: [{ name: 'shot.jpg', bytes, mimeType: 'image/jpeg' }],
    });

    const batch = await store.readBatch('batch-2');
    const saved = await readFile(batch.images[0].path);
    expect(saved).toEqual(bytes);
    await expect(store.readImage('batch-2', 0)).resolves.toEqual({
      mimeType: 'image/jpeg',
      bytes,
    });
    await expect(store.readImage('batch-2', 9)).rejects.toThrow(/image not found/);
  });

  it('updates batch status and draft atomically', async () => {
    const store = createScoreRecognitionStore({ dataDir, storageDir });
    await store.createBatch({
      id: 'batch-3',
      date: '2026-08-01',
      raceType: 'team',
      files: [{ name: 'x.jpg', bytes: Buffer.from([0xff]), mimeType: 'image/jpeg' }],
    });

    await store.updateBatch('batch-3', { status: 'processing' });
    expect((await store.readBatch('batch-3')).status).toBe('processing');

    const draft = { races: [{ type: 'team', members: [] }] };
    await store.updateBatch('batch-3', { status: 'ready', draft });
    const stored = await store.readBatch('batch-3');
    expect(stored.status).toBe('ready');
    expect(stored.draft).toEqual(draft);

    await store.updateBatch('batch-3', {
      status: 'discarded',
      discardReason: 'duplicate of committed batch',
    });
    expect(await store.readBatch('batch-3')).toMatchObject({
      status: 'discarded',
      discardReason: 'duplicate of committed batch',
    });
  });

  it('retries a failed batch while keeping the original images', async () => {
    const store = createScoreRecognitionStore({ dataDir, storageDir });
    const bytes = Buffer.from([0x89, 0x50]);
    await store.createBatch({
      id: 'batch-4',
      date: '2026-08-01',
      raceType: 'team',
      files: [{ name: 'fail.png', bytes, mimeType: 'image/png' }],
    });
    await store.updateBatch('batch-4', { status: 'failed', error: 'timeout' });

    await store.retryBatch('batch-4');
    const retried = await store.readBatch('batch-4');
    expect(retried.status).toBe('uploaded');
    expect(retried.error).toBeUndefined();
    const kept = await readFile(retried.images[0].path);
    expect(kept).toEqual(bytes);
  });

  it('survives concurrent index updates without corrupting the index', async () => {
    const store = createScoreRecognitionStore({ dataDir, storageDir });
    await Promise.all([
      store.createBatch({ id: 'b-a', date: '2026-08-01', raceType: 'team', files: [] }),
      store.createBatch({ id: 'b-b', date: '2026-08-01', raceType: 'team', files: [] }),
      store.createBatch({ id: 'b-c', date: '2026-08-01', raceType: 'team', files: [] }),
    ]);

    const all = await store.listBatches();
    expect(all.map((batch) => batch.id).sort()).toEqual(['b-a', 'b-b', 'b-c']);
  });
});
