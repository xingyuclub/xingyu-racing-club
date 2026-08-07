import { createHash } from 'node:crypto';
import sharp from 'sharp';

const SAMPLE_SIZE = 32;
const SUSPECTED_MEAN_DIFFERENCE = 4;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function buildImageFingerprint(imageBytes) {
  const sample = await sharp(imageBytes)
    .rotate()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  return {
    sha256: sha256(imageBytes),
    pixelHash: sha256(sample),
    sample: sample.toString('base64'),
  };
}

export function compareImageFingerprints(left, right) {
  if (left.sha256 === right.sha256 || left.pixelHash === right.pixelHash) return 'exact';
  const leftSample = Buffer.from(left.sample, 'base64');
  const rightSample = Buffer.from(right.sample, 'base64');
  if (leftSample.length !== rightSample.length || leftSample.length === 0) return 'distinct';

  let difference = 0;
  for (let index = 0; index < leftSample.length; index += 1) {
    difference += Math.abs(leftSample[index] - rightSample[index]);
  }
  return difference / leftSample.length <= SUSPECTED_MEAN_DIFFERENCE
    ? 'suspected'
    : 'distinct';
}
