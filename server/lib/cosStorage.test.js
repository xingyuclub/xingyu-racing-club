import { describe, expect, it, vi } from 'vitest';
import { createCosStorage, createCosStorageFromEnv } from './cosStorage.js';

function createFakeClient() {
  return {
    putObject: vi.fn((_params, callback) => callback(null, {})),
    deleteObject: vi.fn((_params, callback) => callback(null, {})),
    getBucket: vi.fn((_params, callback) => callback(null, {
      Contents: [{ Key: 'originals/a.jpg', Size: '4' }],
      IsTruncated: 'false',
    })),
  };
}

describe('createCosStorage', () => {
  it('rejects missing cloud configuration when cloud storage is required', () => {
    expect(() => createCosStorageFromEnv({}, { required: true }))
      .toThrow('不允许回退到本地上传');
  });

  it('still allows explicitly isolated callers to omit cloud storage', () => {
    expect(createCosStorageFromEnv({})).toBeNull();
  });

  it('rejects incomplete cloud configuration instead of falling back locally', () => {
    expect(() => createCosStorageFromEnv({ COS_SECRET_ID: 'test-id' }, { required: true }))
      .toThrow('COS 配置不完整');
  });

  it('uploads objects with bucket, region and cache metadata', async () => {
    const client = createFakeClient();
    const storage = createCosStorage({
      client,
      bucket: 'bucket-123',
      region: 'ap-guangzhou',
      publicBaseUrl: 'https://media.example.test/',
    });

    const result = await storage.putObject({
      key: 'originals/青山头像.jpg',
      body: Buffer.from('image'),
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000,immutable',
    });

    expect(client.putObject).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'bucket-123',
      Region: 'ap-guangzhou',
      Key: 'originals/青山头像.jpg',
      ContentType: 'image/jpeg',
      CacheControl: 'public,max-age=31536000,immutable',
    }), expect.any(Function));
    expect(result.url).toBe('https://media.example.test/originals/%E9%9D%92%E5%B1%B1%E5%A4%B4%E5%83%8F.jpg');
  });

  it('lists objects and deletes by key', async () => {
    const client = createFakeClient();
    const storage = createCosStorage({
      client,
      bucket: 'bucket-123',
      region: 'ap-guangzhou',
      publicBaseUrl: 'https://media.example.test',
    });

    await expect(storage.listObjects('originals/')).resolves.toEqual([
      { Key: 'originals/a.jpg', Size: '4' },
    ]);
    await storage.deleteObject('originals/a.jpg');
    expect(client.deleteObject).toHaveBeenCalledWith({
      Bucket: 'bucket-123',
      Region: 'ap-guangzhou',
      Key: 'originals/a.jpg',
    }, expect.any(Function));
  });
});
