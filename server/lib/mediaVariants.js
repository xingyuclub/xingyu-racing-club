import { extname } from 'node:path';
import sharp from 'sharp';

const animatedImageExtensions = new Set(['.gif']);

export function getMediaKeys(name, type) {
  const originalKey = `originals/${name}`;
  const extension = extname(name).toLowerCase();
  if (type !== 'image' || animatedImageExtensions.has(extension)) {
    return { originalKey, variantKey: null };
  }

  const stem = name.slice(0, name.length - extension.length);
  return {
    originalKey,
    variantKey: `variants/${stem}--display.webp`,
  };
}

export async function createImageVariant(filePath) {
  return sharp(filePath)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
}
