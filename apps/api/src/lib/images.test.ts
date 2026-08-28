import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_IMAGE_WIDTH,
} from '@vendor-marketplace/shared';
import { MAIN_IMAGE_MAX_EDGE, processUploadedImage, THUMBNAIL_EDGE } from './images.js';

/** A solid-colour JPEG of the requested size, with an EXIF block attached. */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .withExifMerge({ IFD0: { Copyright: 'Someone Else', Artist: 'Camera Owner' } })
    .jpeg()
    .toBuffer();
}

describe('processUploadedImage', () => {
  it('returns both variants as WebP', async () => {
    const processed = await processUploadedImage(await jpeg(1600, 1200), 'image/jpeg');

    expect((await sharp(processed.image).metadata()).format).toBe('webp');
    expect((await sharp(processed.thumbnail).metadata()).format).toBe('webp');
  });

  it('caps the long edge of the main image without upscaling smaller ones', async () => {
    const large = await processUploadedImage(await jpeg(4000, 2000), 'image/jpeg');
    const small = await processUploadedImage(await jpeg(1200, 900), 'image/jpeg');

    expect((await sharp(large.image).metadata()).width).toBe(MAIN_IMAGE_MAX_EDGE);
    // Exactly at the floor, so it is accepted and left at its own size.
    expect((await sharp(small.image).metadata()).width).toBe(1200);
  });

  it('produces a square thumbnail', async () => {
    const processed = await processUploadedImage(await jpeg(1200, 600), 'image/jpeg');
    const meta = await sharp(processed.thumbnail).metadata();

    expect(meta.width).toBe(THUMBNAIL_EDGE);
    expect(meta.height).toBe(THUMBNAIL_EDGE);
  });

  it('strips EXIF from both variants', async () => {
    const processed = await processUploadedImage(await jpeg(1600, 1200), 'image/jpeg');

    expect((await sharp(processed.image).metadata()).exif).toBeUndefined();
    expect((await sharp(processed.thumbnail).metadata()).exif).toBeUndefined();
  });

  it('rejects a MIME type outside the accepted set', async () => {
    await expect(processUploadedImage(await jpeg(1600, 1200), 'image/gif')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('rejects a payload larger than the upload ceiling', async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await expect(processUploadedImage(oversized, 'image/jpeg')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  /*
   * The narrow-image refusal is a quality floor, not a validity one, so it
   * names the width and asks for a larger export rather than calling the file
   * invalid — `40-states.md` treats the two as different messages.
   */
  it('rejects an image narrower than the publishable minimum', async () => {
    await expect(
      processUploadedImage(await jpeg(MIN_UPLOAD_IMAGE_WIDTH - 1, 900), 'image/jpeg'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: `Image is 1199px wide and would look soft. Export it at least 1200px wide.`,
    });
  });

  it('accepts an image exactly at the publishable minimum', async () => {
    await expect(
      processUploadedImage(await jpeg(MIN_UPLOAD_IMAGE_WIDTH, 900), 'image/jpeg'),
    ).resolves.toMatchObject({});
  });

  /*
   * WebP is what this function writes, not something it takes. Offering it in
   * the picker only widened the set of files a vendor could pick and then be
   * refused for, so it left the accepted set at both ends together.
   */
  it('no longer accepts WebP as an input format', async () => {
    const webp = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .webp()
      .toBuffer();

    expect(ACCEPTED_IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png']);
    await expect(processUploadedImage(webp, 'image/webp')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unsupported image type. Upload a JPG or PNG file.',
    });
  });

  it('rejects bytes that are not a decodable image', async () => {
    await expect(
      processUploadedImage(Buffer.from('this is not an image'), 'image/png'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
