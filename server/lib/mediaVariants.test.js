import { describe, expect, it } from 'vitest';
import { createImageVariants, getMediaKeys } from './mediaVariants.js';

describe('media variants', () => {
  it('keeps the original and creates thumbnail, card and display keys for still images', () => {
    expect(getMediaKeys('abc--photo.png', 'image')).toEqual({
      originalKey: 'originals/abc--photo.png',
      variantKeys: {
        thumb: 'variants/abc--photo--thumb.webp',
        card: 'variants/abc--photo--card.webp',
        display: 'variants/abc--photo--display.webp',
      },
    });
  });

  it('creates video keys but does not transform audio or animated GIF files', () => {
    expect(getMediaKeys('clip.mp4', 'video')).toEqual({
      originalKey: 'originals/clip.mp4',
      variantKeys: {
        video720: 'videos/clip--720p.mp4',
        poster: 'posters/clip--poster.webp',
      },
    });
    expect(getMediaKeys('song.mp3', 'audio').variantKeys).toEqual({});
    expect(getMediaKeys('motion.gif', 'image').variantKeys).toEqual({});
  });

  it('creates three decodable WebP sizes without changing the original input', async () => {
    const input = await import('sharp').then(({ default: sharp }) => sharp({
      create: { width: 2400, height: 1800, channels: 3, background: '#4f46e5' },
    }).png().toBuffer());
    const variants = await createImageVariants(input);
    const sharp = await import('sharp').then(({ default: factory }) => factory);
    const metadata = await Promise.all(
      ['thumb', 'card', 'display'].map((name) => sharp(variants[name]).metadata()),
    );
    expect(metadata.map((item) => item.format)).toEqual(['webp', 'webp', 'webp']);
    expect(metadata.map((item) => item.width)).toEqual([480, 960, 1920]);
    expect(input.length).toBeGreaterThan(0);
  });
});
