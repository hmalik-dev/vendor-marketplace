import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';
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
    const processed = await processUploadedImage(await jpeg(800, 600), 'image/jpeg');

    expect((await sharp(processed.image).metadata()).format).toBe('webp');
    expect((await sharp(processed.thumbnail).metadata()).format).toBe('webp');
  });

  it('caps the long edge of the main image without upscaling smaller ones', async () => {
    const large = await processUploadedImage(await jpeg(4000, 2000), 'image/jpeg');
    const small = await processUploadedImage(await jpeg(320, 240), 'image/jpeg');

    expect((await sharp(large.image).metadata()).width).toBe(MAIN_IMAGE_MAX_EDGE);
    expect((await sharp(small.image).metadata()).width).toBe(320);
  });

  it('produces a square thumbnail', async () => {
    const processed = await processUploadedImage(await jpeg(1200, 600), 'image/jpeg');
    const meta = await sharp(processed.thumbnail).metadata();

    expect(meta.width).toBe(THUMBNAIL_EDGE);
    expect(meta.height).toBe(THUMBNAIL_EDGE);
  });

  it('strips EXIF from both variants', async () => {
    const processed = await processUploadedImage(await jpeg(800, 600), 'image/jpeg');

    expect((await sharp(processed.image).metadata()).exif).toBeUndefined();
    expect((await sharp(processed.thumbnail).metadata()).exif).toBeUndefined();
  });

  it('rejects a MIME type outside the accepted set', async () => {
    await expect(processUploadedImage(await jpeg(64, 64), 'image/gif')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('rejects a payload larger than the upload ceiling', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);

    await expect(processUploadedImage(oversized, 'image/jpeg')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects bytes that are not a decodable image', async () => {
    await expect(
      processUploadedImage(Buffer.from('this is not an image'), 'image/png'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
