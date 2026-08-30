import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_IMAGE_WIDTH,
} from '@vendor-marketplace/shared';
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
 * What sharp reports for each format we accept.
 *
 * The declared `Content-Type` is a claim; this is what the bytes are. Renaming
 * a GIF to `.png` and declaring `image/png` satisfied the allow-list, and the
 * only thing standing behind it was a decode that accepts **every** format
 * libvips supports — so the two-format allow-list was in practice "anything
 * sharp can read", which includes SVG, TIFF, AVIF and GIF.
 */
const ACCEPTED_DECODED_FORMATS: readonly string[] = ['jpeg', 'png'];

/**
 * Refuses an image whose bytes are not what it says they are, or that is too
 * narrow to publish.
 *
 * One `metadata()` call answers both. It is a header parse rather than a full
 * decode, so it costs far less than the resize it can save — and it is the only
 * place the *actual* format is knowable before the re-encode throws away the
 * evidence.
 */
async function assertDecodableAndWideEnough(buffer: Buffer): Promise<void> {
  let width: number | undefined;
  let format: string | undefined;

  try {
    ({ width, format } = await sharp(buffer).metadata());
  } catch {
    // A buffer sharp cannot read at all is reported by the decode below, which
    // has the better message for it.
    return;
  }

  /*
   * The same sentence the declared-type check uses. A caller who renamed a file
   * and a caller who picked the wrong one are in the same position and need the
   * same instruction; saying "your PNG is really a GIF" would be describing our
   * detection rather than their fix.
   */
  /*
   * `format === undefined` refuses too. An allowlist that skips itself on a
   * missing value falls through to the decode, and the decode accepts every
   * format libvips reads — which is the hole this exists to close.
   */
  if (format === undefined || !ACCEPTED_DECODED_FORMATS.includes(format)) {
    throw validationFailed(`Unsupported image type. Upload a ${ACCEPTED_IMAGE_LABEL} file.`);
  }

  if (width !== undefined && width < MIN_UPLOAD_IMAGE_WIDTH) {
    throw validationFailed(
      `Image is ${width}px wide and would look soft. Export it at least ${MIN_UPLOAD_IMAGE_WIDTH}px wide.`,
    );
  }
}

/**
 * Normalises an untrusted upload into two WebP variants.
 *
 * The client-declared MIME type is checked first as a cheap filter, but it is
 * not trusted, and neither is the declared type: `sharp` reads the actual
 * bytes, so a `.png` that is really a GIF is refused by its decoded format
 * rather than reaching storage on the strength of its header. `rotate()` bakes in the EXIF
 * orientation before the metadata is discarded, otherwise stripping EXIF would
 * silently turn portrait photos sideways.
 */
export async function processUploadedImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessedImage> {
  if (!isAcceptedMimeType(mimeType)) {
    throw validationFailed(`Unsupported image type. Upload a ${ACCEPTED_IMAGE_LABEL} file.`);
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw validationFailed(
      `Image is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
    );
  }

  if (buffer.length === 0) {
    throw validationFailed('Image file is empty.');
  }

  await assertDecodableAndWideEnough(buffer);

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
