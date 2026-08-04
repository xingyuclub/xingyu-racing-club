// @vitest-environment node

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prepareRecognitionImage } from './scoreRecognitionImage.js';

describe('prepareRecognitionImage', () => {
  it('scales a large screenshot down without changing its aspect ratio', async () => {
    const imageBytes = await sharp({
      create: {
        width: 2781,
        height: 1280,
        channels: 3,
        background: '#ffffff',
      },
    }).jpeg().toBuffer();

    const prepared = await prepareRecognitionImage({ imageBytes, mimeType: 'image/jpeg' });
    const metadata = await sharp(prepared.imageBytes).metadata();

    expect(prepared.mimeType).toBe('image/jpeg');
    expect(metadata.width).toBe(2048);
    expect(metadata.height).toBe(943);
  });

  it('keeps an already suitable screenshot unchanged', async () => {
    const imageBytes = await sharp({
      create: {
        width: 2048,
        height: 966,
        channels: 3,
        background: '#ffffff',
      },
    }).jpeg().toBuffer();

    const prepared = await prepareRecognitionImage({ imageBytes, mimeType: 'image/jpeg' });

    expect(prepared.imageBytes.equals(imageBytes)).toBe(true);
  });
});
