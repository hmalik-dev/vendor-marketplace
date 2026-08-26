import { ACCEPTED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import sharp from 'sharp';
import { validationFailed } from './errors.js';

/**
 * Longest edge kept on the full-size variant. Cover images render at most
 * 1440px wide on the largest target viewport, so anything beyond this is
 * bandwidth nobody sees.
 */
export const MAIN_IMAGE_MAX_EDGE = 1_600;

/** Thumbnails are square: they appear as avatars and grid tiles. */
export const THUMBNAIL_EDGE = 400;

/** Quality/size trade-off for both WebP variants. */
const WEBP_QUALITY = 82;

export interface ProcessedImage {
  image: Buffer;
  thumbnail: Buffer;
}

function isAcceptedMimeType(value: string): boolean {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Normalises an untrusted upload into two WebP variants.
 *
 * The client-declared MIME type is checked first as a cheap filter, but it is
 * not trusted: `sharp` decodes the actual bytes, so a `.png` full of something
 * else fails here rather than reaching storage. `rotate()` bakes in the EXIF
 * orientation before the metadata is discarded, otherwise stripping EXIF would
 * silently turn portrait photos sideways.
 */
export async function processUploadedImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessedImage> {
  if (!isAcceptedMimeType(mimeType)) {
    throw validationFailed(
      `Unsupported image type. Upload a ${ACCEPTED_IMAGE_MIME_TYPES.join(', ')} file.`,
    );
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw validationFailed(
      `Image is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit.`,
    );
  }

  if (buffer.length === 0) {
    throw validationFailed('Image file is empty.');
  }

  try {
    // `sharp` instances are single-use once consumed, so each variant reads
    // the original buffer rather than sharing a pipeline.
    const image = await sharp(buffer)
      .rotate()
      .resize({
        width: MAIN_IMAGE_MAX_EDGE,
        height: MAIN_IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const thumbnail = await sharp(buffer)
      .rotate()
      .resize({ width: THUMBNAIL_EDGE, height: THUMBNAIL_EDGE, fit: 'cover', position: 'centre' })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return { image, thumbnail };
  } catch (error) {
    // Anything sharp rejects here is a malformed or unreadable upload, which
    // is the caller's fault rather than a server fault.
    throw validationFailed('That file could not be read as an image.', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
