// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createPublicConfigPublisher, serializePublicConfig } from './publicConfigPublisher.js';

const rawConfig = {
  team: { name: '星屿', heroLines: ['欢迎'] },
  stats: { teamRank: 1, activeRank: 2, memberCount: 3, singleCount: 4 },
  roster: [],
  scoreMembers: [],
  albums: [],
  dailyScores: [],
  weekendScores: [],
  memberAliases: [],
  news: [],
  newsCategories: [],
  music: { src: '', cover: '' },
};

describe('public config publisher', () => {
  it('serializes config as a browser-loadable global without unsafe line separators', () => {
    const output = serializePublicConfig({ text: 'a\u2028b\u2029c' });
    expect(output).toContain('window.__XINGYU_SITE_CONFIG__ =');
    expect(output).toContain('a\\u2028b\\u2029c');
  });

  it('hydrates and uploads the public config with no-store caching', async () => {
    const putObject = vi.fn().mockResolvedValue({ url: 'https://cdn.test/config/site-config.js' });
    const publish = createPublicConfigPublisher({
      configStore: { read: vi.fn().mockResolvedValue(rawConfig) },
      mediaStorage: { putObject },
    });

    const result = await publish();

    expect(result.key).toBe('config/site-config.js');
    expect(putObject).toHaveBeenCalledWith(expect.objectContaining({
      key: 'config/site-config.js',
      contentType: 'application/javascript; charset=utf-8',
      cacheControl: 'no-cache, no-store, max-age=0, must-revalidate',
    }));
    const body = putObject.mock.calls[0][0].body.toString('utf8');
    expect(body).toContain('window.__XINGYU_SITE_CONFIG__');
    expect(body).toContain('"featuredMembers"');
  });
});
