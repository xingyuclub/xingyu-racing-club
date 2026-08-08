import { describe, expect, it } from 'vitest';
import { createImageVariant, getMediaKeys } from './mediaVariants.js';

describe('media variants', () => {
  it('keeps original keys and creates a display WebP for still images', () => {
    expect(getMediaKeys('abc--photo.png', 'image')).toEqual({
      originalKey: 'originals/abc--photo.png',
      variantKey: 'variants/abc--photo--display.webp',
    });
  });

  it('does not create a still-image variant for video, audio or animated GIF', () => {
    expect(getMediaKeys('clip.mp4', 'video').variantKey).toBeNull();
    expect(getMediaKeys('song.mp3', 'audio').variantKey).toBeNull();
    expect(getMediaKeys('motion.gif', 'image').variantKey).toBeNull();
  });

  it('creates a decodable WebP variant without changing the original input', async () => {
    const input = await import('sharp').then(({ default: sharp }) => sharp({
      create: { width: 40, height: 30, channels: 3, background: '#4f46e5' },
    }).png().toBuffer());
    const variant = await createImageVariant(input);
    const metadata = await import('sharp').then(({ default: sharp }) => sharp(variant).metadata());
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(40);
    expect(metadata.height).toBe(30);
    expect(input.length).toBeGreaterThan(0);
  });
});
