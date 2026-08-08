import { describe, expect, it } from 'vitest';
import { resolvePublicAssetPath, resolvePublicAssetPaths } from './publicAsset.js';

describe('public asset paths', () => {
  it('prefixes project-relative static assets for GitHub Pages', () => {
    expect(resolvePublicAssetPath('/images/icons/search.png', '/xingyu-h5/'))
      .toBe('/xingyu-h5/images/icons/search.png');
    expect(resolvePublicAssetPath('https://media.example.test/photo.webp', '/xingyu-h5/'))
      .toBe('https://media.example.test/photo.webp');
  });

  it('rewrites nested fallback config without changing CDN URLs', () => {
    expect(resolvePublicAssetPaths({
      cover: '/images/cover.png',
      photos: [{ src: '/images/photo.jpg' }, { src: 'https://cdn.test/photo.webp' }],
    }, '/repo/')).toEqual({
      cover: '/repo/images/cover.png',
      photos: [{ src: '/repo/images/photo.jpg' }, { src: 'https://cdn.test/photo.webp' }],
    });
  });
});
