import sharp from 'sharp';

const MAX_IMAGE_EDGE = 2048;

export async function prepareRecognitionImage({ imageBytes, mimeType }) {
  const metadata = await sharp(imageBytes).metadata();
  const isAlreadySuitable = metadata.width <= MAX_IMAGE_EDGE
    && metadata.height <= MAX_IMAGE_EDGE
    && (!metadata.orientation || metadata.orientation === 1);
  if (isAlreadySuitable) return { imageBytes, mimeType };

  let pipeline = sharp(imageBytes)
    .rotate()
    .resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });

  pipeline = mimeType === 'image/png'
    ? pipeline.png()
    : pipeline.jpeg({ quality: 90 });

  return {
    imageBytes: await pipeline.toBuffer(),
    mimeType,
  };
}
