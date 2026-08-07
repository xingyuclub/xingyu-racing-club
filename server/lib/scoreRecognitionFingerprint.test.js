// @vitest-environment node

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  buildImageFingerprint,
  compareImageFingerprints,
} from './scoreRecognitionFingerprint.js';

async function solidImage(color, format = 'png') {
  const pipeline = sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: color,
    },
  });
  return format === 'jpeg'
    ? pipeline.jpeg({ quality: 76 }).toBuffer()
    : pipeline.png().toBuffer();
}

async function scoreCard(format = 'png') {
  const pixels = Buffer.alloc(160 * 100 * 3, 18);
  for (let y = 15; y < 80; y += 20) {
    for (let x = 12; x < 148; x += 1) {
      const offset = (y * 160 + x) * 3;
      pixels[offset] = 210;
      pixels[offset + 1] = 220;
      pixels[offset + 2] = 235;
    }
  }
  const pipeline = sharp(pixels, { raw: { width: 160, height: 100, channels: 3 } });
  return format === 'jpeg'
    ? pipeline.jpeg({ quality: 68 }).toBuffer()
    : pipeline.png().toBuffer();
}

describe('score recognition image fingerprints', () => {
  it('classifies identical bytes as an exact duplicate', async () => {
    const bytes = await scoreCard();
    const first = await buildImageFingerprint(bytes);
    const second = await buildImageFingerprint(Buffer.from(bytes));

    expect(first.sha256).toBe(second.sha256);
    expect(compareImageFingerprints(first, second)).toBe('exact');
  });

  it('classifies the same rendered screenshot with different compression as suspected', async () => {
    const png = await buildImageFingerprint(await scoreCard('png'));
    const jpeg = await buildImageFingerprint(await scoreCard('jpeg'));

    expect(png.sha256).not.toBe(jpeg.sha256);
    expect(compareImageFingerprints(png, jpeg)).toBe('suspected');
  });

  it('keeps visually different screenshots distinct', async () => {
    const dark = await buildImageFingerprint(await solidImage('#101828'));
    const light = await buildImageFingerprint(await solidImage('#f6d365'));

    expect(compareImageFingerprints(dark, light)).toBe('distinct');
  });
});
