import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  ERROR_CODES,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_IMAGE_WIDTH,
} from '@vendor-marketplace/shared';
import sharp from 'sharp';
import { AppError, validationFailed } from './errors.js';

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

/**
 * Most pixels a decode may produce (40 MP, above any phone camera). sharp's
 * own default is ~268 MP, which a 12 MB PNG can declare and which decodes to
 * about 800 MB of RGB.
 */
export const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Sharp pipelines that may run at once. Each holds a full decoded frame, so an
 * unbounded burst of uploads is a burst of memory and libvips threads.
 */
export const MAX_CONCURRENT_IMAGE_JOBS = 2;

/**
 * Uploads that may wait for a slot. A waiter holds its whole buffer (up to
 * `MAX_UPLOAD_BYTES`), so an unbounded queue is an unbounded memory ceiling;
 * past this depth the request is refused and its buffer released at once.
 */
export const MAX_QUEUED_IMAGE_JOBS = 8;

// sharp's default `failOn: 'warning'` is kept on purpose: it is the strictest
// setting, so truncated or corrupt files are refused rather than decoded.
const SHARP_INPUT_OPTIONS = { limitInputPixels: MAX_INPUT_PIXELS } as const;

let activeJobs = 0;
const waitingJobs: Array<() => void> = [];

async function withImageSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeJobs >= MAX_CONCURRENT_IMAGE_JOBS) {
    if (waitingJobs.length >= MAX_QUEUED_IMAGE_JOBS) {
      throw new AppError(
        429,
        ERROR_CODES.RATE_LIMITED,
        'Image processing is busy. Try again shortly.',
      );
    }
    // The finishing job hands its slot straight to us, so `activeJobs` stays put.
    await new Promise<void>((resolve) => waitingJobs.push(resolve));
  } else {
    activeJobs += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingJobs.shift();
    if (next) {
      next();
    } else {
      activeJobs -= 1;
    }
  }
}

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
 * libvips supports — so the allow-list was in practice "anything
 * sharp can read", which includes SVG, TIFF, AVIF and GIF.
 */
const ACCEPTED_DECODED_FORMATS: readonly string[] = ['jpeg', 'png', 'webp'];

/** EXIF orientations 5-8 swap the image's width and height; 1-4 and junk do not. */
const EXIF_QUARTER_TURNS: readonly number[] = [5, 6, 7, 8];

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
  let pixels: number | undefined;

  try {
    // No pixel limit here: sharp would throw on an oversized header and the
    // catch below would swallow it, losing the specific message. The limit is
    // applied by the explicit check below and by both decodes.
    const metadata = await sharp(buffer).metadata();
    format = metadata.format;
    pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
    /*
     * EXIF orientations 5-8 turn the image a quarter turn, so the stored width
     * is the displayed height. The client measures after orientation
     * (`createImageBitmap`) and the re-encode below applies `rotate()`, so the
     * floor has to be checked on the same side.
     */
    const quarterTurned = EXIF_QUARTER_TURNS.includes(metadata.orientation ?? 1);
    width = quarterTurned ? metadata.height : metadata.width;
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

  /*
   * The header's claim, checked before any pixel is decoded. sharp enforces the
   * same ceiling during the decode, but only this check gives the caller a
   * sentence they can act on.
   */
  if (pixels !== undefined && pixels > MAX_INPUT_PIXELS) {
    throw validationFailed(
      `Image is too large to process (over ${MAX_INPUT_PIXELS / 1_000_000} megapixels). Export a smaller copy.`,
    );
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

  // A header parse: refusals it can make never need a slot, so they never queue.
  await assertDecodableAndWideEnough(buffer);

  return withImageSlot(async () => {
    try {
      // `sharp` instances are single-use once consumed, so each variant reads
      // the original buffer rather than sharing a pipeline.
      const image = await sharp(buffer, SHARP_INPUT_OPTIONS)
        .rotate()
        .resize({
          width: MAIN_IMAGE_MAX_EDGE,
          height: MAIN_IMAGE_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const thumbnail = await sharp(buffer, SHARP_INPUT_OPTIONS)
        .rotate()
        .resize({ width: THUMBNAIL_EDGE, height: THUMBNAIL_EDGE, fit: 'cover', position: 'centre' })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      return { image, thumbnail };
    } catch {
      // Anything sharp rejects here is a malformed or unreadable upload, which
      // is the caller's fault rather than a server fault. Its own message names
      // libvips loaders and offsets, which are internals, so none of it is echoed.
      throw validationFailed('That file could not be read as an image.');
    }
  });
}
