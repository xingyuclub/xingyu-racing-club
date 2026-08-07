import sharp from 'sharp';

// 2048 上限会把 2781×1280 这类结算截图压到约 942 高，本地模型对小字昵称/名次
// 识别错误（实测把 Rose 读成星屿并幻觉出多个变体）；放宽到 4096 保留原图细节。
const MAX_IMAGE_EDGE = 4096;

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
