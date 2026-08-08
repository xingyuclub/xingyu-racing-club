import { Buffer } from 'node:buffer';
import { hydrateSiteData } from '../../src/data/siteConfig.js';

const DEFAULT_KEY = 'config/site-config.js';

export function serializePublicConfig(config) {
  const json = JSON.stringify(config)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
  return `window.__XINGYU_SITE_CONFIG__ = ${json};\n`;
}

export function createPublicConfigPublisher({ configStore, mediaStorage, key = DEFAULT_KEY }) {
  if (!configStore || !mediaStorage) return null;

  return async function publishPublicConfig() {
    const config = hydrateSiteData(await configStore.read());
    const body = Buffer.from(serializePublicConfig(config), 'utf8');
    const result = await mediaStorage.putObject({
      key,
      body,
      contentType: 'application/javascript; charset=utf-8',
      cacheControl: 'no-cache, no-store, max-age=0, must-revalidate',
    });
    return { ...result, key };
  };
}
