import sharp from 'sharp';
import { users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { USER_ROLES, type UserRole } from '@vendor-marketplace/shared';
import { STORAGE_PREFIXES, type StoragePrefix } from '../../lib/storage.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const ADMIN = 'user_admin';
const BOUNDARY = '----vendormarketplacetestboundary';

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

// Wider than `MIN_UPLOAD_IMAGE_WIDTH`, so the fixture clears the publishable
// floor and these tests stay about routing rather than about image quality.
async function jpegBytes(width = 1600, height = 1200): Promise<Buffer> {
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
      [ADMIN, 'admin'],
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

  /*
   * Authorization is a matrix, not an example. The bug this replaces gated the
   * whole route on the vendor role, which made the `customer-profile` prefix
   * the route itself declares unreachable by the only role that would use it.
   *
   * The rows are derived from `STORAGE_PREFIXES` rather than retyped, and
   * `Record<StoragePrefix, ...>` makes a prefix added later a compile error
   * here as well as in the source — so a new namespace cannot ship untested.
   */
  const MAY_UPLOAD: Record<StoragePrefix, UserRole> = {
    'vendor-profile': 'vendor',
    'vendor-cover': 'vendor',
    portfolio: 'vendor',
    'customer-profile': 'customer',
  };

  /*
   * Driven off `USER_ROLES`, never a hand-written union — `shared-contracts.md`
   * forbids redeclaring one even when it currently matches. It is also what
   * puts `admin` in the matrix: an admin owns no namespace, and nothing else
   * asserts that a third role is refused everywhere.
   */
  const CALLERS: Record<UserRole, string> = {
    vendor: VENDOR,
    customer: CUSTOMER,
    admin: ADMIN,
  };

  /*
   * `normalizeRole` refuses to take `admin` from Clerk metadata, which is the
   * control that stops a user self-promoting — so an admin cannot be minted
   * through the sync path and has to be written directly. Signing in first is
   * what creates the row the update then promotes.
   */
  async function signInAs(role: UserRole): Promise<void> {
    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(CALLERS[role]) });

    if (role === 'admin') {
      await harness.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.clerkUserId, ADMIN));
    }
  }

  for (const prefix of STORAGE_PREFIXES) {
    for (const role of USER_ROLES) {
      const allowed = MAY_UPLOAD[prefix] === role;
      const article = role === 'admin' ? 'an' : 'a';

      it(`${article} ${role} ${allowed ? 'may' : 'may not'} upload to ${prefix}`, async () => {
        await signInAs(role);

        const response = await harness.app.inject({
          method: 'POST',
          url: `/upload/image?prefix=${prefix}`,
          headers: { ...MULTIPART_HEADERS, ...bearer(CALLERS[role]) },
          payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
        });

        expect(response.statusCode).toBe(allowed ? 201 : 403);

        if (allowed) {
          expect(response.json().imageKey.startsWith(`${prefix}/`)).toBe(true);
          expect(harness.storedObjects).toHaveLength(2);
        } else {
          // A refused upload stores nothing at all, not even the thumbnail.
          expect(harness.storedObjects).toHaveLength(0);
        }
      });
    }
  }

  it('refuses every prefix to a signed-out caller', async () => {
    for (const prefix of STORAGE_PREFIXES) {
      const response = await harness.app.inject({
        method: 'POST',
        url: `/upload/image?prefix=${prefix}`,
        headers: MULTIPART_HEADERS,
        payload: multipartBody('a.jpg', 'image/jpeg', await jpegBytes()),
      });

      expect(response.statusCode).toBe(401);
    }

    expect(harness.storedObjects).toHaveLength(0);
  });

  it('never names the role it wanted in the refusal a caller can read', () =>
    harness.app
      .inject({
        method: 'POST',
        url: '/upload/image?prefix=vendor-profile',
        headers: { ...MULTIPART_HEADERS, ...bearer(CUSTOMER) },
        payload: multipartBody('a.jpg', 'image/jpeg', Buffer.from('x')),
      })
      .then((response) => {
        expect(response.statusCode).toBe(403);
        expect(response.json().message).not.toMatch(/\brole\b/);
      }));

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
