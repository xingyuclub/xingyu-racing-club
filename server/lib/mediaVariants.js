import { extname } from 'node:path';
import sharp from 'sharp';

const animatedImageExtensions = new Set(['.gif']);
const imageVariantSpecs = {
  thumb: { size: 480, quality: 76 },
  card: { size: 960, quality: 80 },
  display: { size: 1920, quality: 84 },
};

export function getMediaKeys(name, type) {
  const originalKey = `originals/${name}`;
  const extension = extname(name).toLowerCase();
  const stem = name.slice(0, name.length - extension.length);

  if (type === 'video') {
    return {
      originalKey,
      variantKeys: {
        video720: `videos/${stem}--720p.mp4`,
        poster: `posters/${stem}--poster.webp`,
      },
    };
  }

  if (type !== 'image' || animatedImageExtensions.has(extension)) {
    return { originalKey, variantKeys: {} };
  }

  return {
    originalKey,
    variantKeys: Object.fromEntries(
      Object.keys(imageVariantSpecs).map((variant) => [
        variant,
        `variants/${stem}--${variant}.webp`,
      ]),
    ),
  };
}

export async function createImageVariants(filePath) {
  return Object.fromEntries(await Promise.all(
    Object.entries(imageVariantSpecs).map(async ([name, spec]) => [
      name,
      await sharp(filePath)
        .rotate()
        .resize({ width: spec.size, height: spec.size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: spec.quality })
        .toBuffer(),
    ]),
  ));
}
