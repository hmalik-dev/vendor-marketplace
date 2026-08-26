import sharp from 'sharp';
import { users } from '@vendorhub/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const BOUNDARY = '----vendorhubtestboundary';

/** Builds a `multipart/form-data` body containing exactly one file part. */
function multipartBody(filename: string, contentType: string, content: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

const MULTIPART_HEADERS = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };

async function jpegBytes(width = 900, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 90, b: 140 } },
  })
    .jpeg()
    .toBuffer();
}

describe('POST /upload/image', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }
  });

  afterEach(async () => {
    harness.storedObjects.length = 0;
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('rejects an unauthenticated upload', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: MULTIPART_HEADERS,
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    expect(response.statusCode).toBe(401);
    expect(harness.storedObjects).toHaveLength(0);
  });

  it('rejects a customer', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: { ...MULTIPART_HEADERS, ...bearer(CUSTOMER) },
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    expect(response.statusCode).toBe(403);
    expect(harness.storedObjects).toHaveLength(0);
  });

  it('stores both variants and returns their public URLs', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.imageUrl).toMatch(/^http:\/\/cdn\.test\/vendor-profile\/[0-9a-f-]{36}\.webp$/);
    expect(body.thumbnailUrl).toBe(body.imageUrl.replace('.webp', '-thumb.webp'));
    expect(response.headers.location).toBe(body.imageUrl);
    expect(harness.storedObjects).toHaveLength(2);
  });

  it('re-encodes the upload as WebP before storing it', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-cover',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    for (const stored of harness.storedObjects) {
      expect(stored.contentType).toBe('image/webp');
      expect((await sharp(stored.body).metadata()).format).toBe('webp');
    }
  });

  it('namespaces the object by the requested prefix', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=portfolio',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    expect(harness.storedObjects[0]?.key.startsWith('portfolio/')).toBe(true);
  });

  it('rejects a prefix outside the known set', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=../../etc',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
    });

    expect(response.statusCode).toBe(400);
    expect(harness.storedObjects).toHaveLength(0);
  });

  it('rejects a non-image MIME type', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('notes.pdf', 'application/pdf', Buffer.from('%PDF-1.4')),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toMatch(/unsupported image type/i);
    expect(harness.storedObjects).toHaveLength(0);
  });

  it('rejects bytes that only claim to be an image', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: multipartBody('a.png', 'image/png', Buffer.from('<script>alert(1)</script>')),
    });

    expect(response.statusCode).toBe(400);
    expect(harness.storedObjects).toHaveLength(0);
  });

  it('rejects a request with no file part', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: MULTIPART_HEADERS,
      payload: Buffer.from(`--${BOUNDARY}--\r\n`),
    });

    // Unauthenticated requests never reach the handler, so this asserts the
    // authenticated no-file path.
    const authenticated = await harness.app.inject({
      method: 'POST',
      url: '/upload/image?prefix=vendor-profile',
      headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
      payload: Buffer.from(`--${BOUNDARY}--\r\n`),
    });

    expect(response.statusCode).toBe(401);
    expect(authenticated.statusCode).toBe(400);
    expect(authenticated.json().message).toMatch(/attach an image/i);
  });

  it('never reuses an object key across uploads', async () => {
    for (let i = 0; i < 2; i += 1) {
      await harness.app.inject({
        method: 'POST',
        url: '/upload/image?prefix=portfolio',
        headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
        payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
      });
    }

    const keys = new Set(harness.storedObjects.map((object) => object.key));
    expect(keys.size).toBe(4);
  });
});
