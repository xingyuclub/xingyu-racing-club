import COS from 'cos-nodejs-sdk-v5';

function callClient(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function encodeKey(key) {
  return String(key)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function createCosStorage({ client, bucket, region, publicBaseUrl }) {
  if (!client) throw new Error('COS client is required');
  if (!bucket || !region || !publicBaseUrl) {
    throw new Error('COS bucket, region and public base URL are required');
  }

  const baseUrl = String(publicBaseUrl).replace(/\/+$/, '');
  const requestBase = { Bucket: bucket, Region: region };

  return {
    bucket,
    region,
    publicUrl(key) {
      return `${baseUrl}/${encodeKey(key)}`;
    },
    async putObject({ key, body, contentType, cacheControl }) {
      await callClient(client, 'putObject', {
        ...requestBase,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
      });
      return { key, url: this.publicUrl(key) };
    },
    async deleteObject(key) {
      await callClient(client, 'deleteObject', { ...requestBase, Key: key });
    },
    async listObjects(prefix = '') {
      const objects = [];
      let marker = '';
      do {
        const response = await callClient(client, 'getBucket', {
          ...requestBase,
          Prefix: prefix,
          ...(marker ? { Marker: marker } : {}),
        });
        objects.push(...(response.Contents || []));
        marker = response.IsTruncated === 'true' ? response.NextMarker || '' : '';
      } while (marker);
      return objects;
    },
  };
}

export function createCosStorageFromEnv(env = process.env, { required = false } = {}) {
  const secretId = String(env.COS_SECRET_ID || '').trim();
  const secretKey = String(env.COS_SECRET_KEY || '').trim();
  const bucket = String(env.COS_BUCKET || '').trim();
  const region = String(env.COS_REGION || '').trim();
  const publicBaseUrl = String(env.COS_CDN_BASE_URL || '').trim();
  const hasAnySecret = Boolean(secretId || secretKey);

  if (!hasAnySecret) {
    if (required) {
      throw new Error('站点素材必须上传腾讯云，请先配置 .env 中的 COS_* 字段；不允许回退到本地上传。');
    }
    return null;
  }
  if (!secretId || !secretKey || !bucket || !region || !publicBaseUrl) {
    throw new Error('COS 配置不完整，请填写 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION 和 COS_CDN_BASE_URL');
  }

  return createCosStorage({
    client: new COS({ SecretId: secretId, SecretKey: secretKey }),
    bucket,
    region,
    publicBaseUrl,
  });
}
