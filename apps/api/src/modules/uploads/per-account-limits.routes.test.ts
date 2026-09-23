import { randomUUID } from 'node:crypto';
import { users } from '@vendor-marketplace/db/schema';
import type { InjectOptions } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/*
 * VEN-484. Every route below counts the signed-in account, not the address: two
 * accounts share one `remoteAddress` throughout, so a bucket keyed on the
 * address would starve the second account and these assertions would fail.
 *
 * The requests are deliberately ones the handler refuses (unknown vendor,
 * unknown thread, unreadable image). The limiter runs before the handler, so
 * the 429 is the only thing asserted about the boundary and no fixture is
 * needed to reach it.
 */

const SHARED_ADDRESS = '10.9.9.9';
const BOUNDARY = '----vendormarketplacetestboundary';
const MULTIPART_HEADERS = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };

// Small, so the suite exercises the configured ceiling rather than a literal.
const LIMITS = {
  UPLOAD_RATE_LIMIT_MAX: 3,
  MESSAGE_RATE_LIMIT_MAX: 4,
  CONVERSATION_RATE_LIMIT_MAX: 5,
  BOOKING_REQUEST_RATE_LIMIT_MAX: 6,
};

const VENDOR_ONE = 'user_limit_vendor_one';
const VENDOR_TWO = 'user_limit_vendor_two';
const CUSTOMER_ONE = 'user_limit_customer_one';
const CUSTOMER_TWO = 'user_limit_customer_two';

function unreadableImage(): Buffer {
  return Buffer.from(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="a.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\nnot an image\r\n--${BOUNDARY}--\r\n`,
  );
}

interface LimitCase {
  name: string;
  limit: number;
  role: 'vendor' | 'customer';
  users: [string, string];
  request: (authUserId: string) => InjectOptions;
}

describe('per-account limits (VEN-484)', () => {
  let harness: TestHarness;

  async function signIn(authUserId: string, role: 'vendor' | 'customer'): Promise<string> {
    harness.authUsers.set(authUserId, {
      authUserId,
      email: `${authUserId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      roleHint: role,
      avatarUrl: null,
    });
    const me = await harness.app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: bearer(authUserId),
    });
    expect(me.statusCode).toBe(200);

    return me.json().id;
  }

  /** Fires `count` requests as `authUserId` and returns every status code. */
  async function fire(
    count: number,
    request: (authUserId: string) => InjectOptions,
    authUserId: string,
  ): Promise<number[]> {
    const statuses: number[] = [];

    for (let index = 0; index < count; index += 1) {
      const response = await harness.app.inject({
        ...request(authUserId),
        remoteAddress: SHARED_ADDRESS,
      });
      statuses.push(response.statusCode);
    }

    return statuses;
  }

  beforeAll(async () => {
    harness = await createTestHarness({ env: LIMITS });
  });

  afterAll(async () => {
    await harness.database.db.delete(users);
    await harness.close();
  });

  const cases: LimitCase[] = [
    {
      name: 'image uploads',
      limit: LIMITS.UPLOAD_RATE_LIMIT_MAX,
      role: 'vendor',
      users: [VENDOR_ONE, VENDOR_TWO],
      request: (authUserId: string) => ({
        method: 'POST' as const,
        url: '/v1/upload/image?prefix=portfolio',
        headers: { ...MULTIPART_HEADERS, ...bearer(authUserId) },
        payload: unreadableImage(),
      }),
    },
    {
      name: 'message sends',
      limit: LIMITS.MESSAGE_RATE_LIMIT_MAX,
      role: 'customer',
      users: [CUSTOMER_ONE, CUSTOMER_TWO],
      request: (authUserId: string) => ({
        method: 'POST' as const,
        url: `/v1/conversations/${randomUUID()}/messages`,
        headers: bearer(authUserId),
        payload: { content: 'Hello' },
      }),
    },
    {
      name: 'conversation opens',
      limit: LIMITS.CONVERSATION_RATE_LIMIT_MAX,
      role: 'customer',
      users: [CUSTOMER_ONE, CUSTOMER_TWO],
      request: (authUserId: string) => ({
        method: 'POST' as const,
        url: '/v1/conversations',
        headers: bearer(authUserId),
        payload: { vendorSlug: 'nobody-here' },
      }),
    },
    {
      name: 'booking request creation',
      limit: LIMITS.BOOKING_REQUEST_RATE_LIMIT_MAX,
      role: 'customer',
      users: [CUSTOMER_ONE, CUSTOMER_TWO],
      request: (authUserId: string) => ({
        method: 'POST' as const,
        url: '/v1/booking-requests',
        headers: bearer(authUserId),
        payload: {
          vendorId: randomUUID(),
          packageId: randomUUID(),
          eventDate: '2099-06-01',
          eventType: 'wedding',
        },
      }),
    },
  ];

  for (const { name, limit, role, users: pair, request } of cases) {
    it(`limits ${name} to ${limit} per account, not per address`, async () => {
      const [first, second] = pair;
      await signIn(first, role);
      await signIn(second, role);

      const within = await fire(limit, request, first);
      expect(within).not.toContain(429);

      expect(await fire(1, request, first)).toEqual([429]);

      // Same address, different account: unaffected.
      expect(await fire(1, request, second)).not.toContain(429);
    });
  }
});

describe('the per-account upload cap (VEN-484)', () => {
  let harness: TestHarness;
  const VENDOR = 'user_cap_vendor';

  beforeAll(async () => {
    harness = await createTestHarness({ env: { UPLOAD_OBJECT_LIMIT: 2 } });
    harness.authUsers.set(VENDOR, {
      authUserId: VENDOR,
      email: 'cap@example.com',
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'vendor',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.database.db.delete(users);
    await harness.close();
  });

  function stored(ownerId: string, name: string): void {
    for (const key of [
      `portfolio/${ownerId}/${name}.webp`,
      `portfolio/${ownerId}/${name}-thumb.webp`,
    ]) {
      harness.storedObjects.push({ key, body: Buffer.from('x'), contentType: 'image/webp' });
    }
  }

  it('refuses at the cap, counts images not thumbnails, and frees a slot on delete', async () => {
    const me = await harness.app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: bearer(VENDOR),
    });
    const id: string = me.json().id;

    const upload = async () => {
      const { default: sharp } = await import('sharp');
      const jpeg = await sharp({
        create: { width: 1600, height: 1200, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .jpeg()
        .toBuffer();

      return harness.app.inject({
        method: 'POST',
        url: '/v1/upload/image?prefix=portfolio',
        headers: { ...MULTIPART_HEADERS, ...bearer(VENDOR) },
        payload: Buffer.concat([
          Buffer.from(
            `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
          ),
          jpeg,
          Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
        ]),
      });
    };

    stored(id, 'one');
    // One image (two objects) is under a cap of two.
    expect((await upload()).statusCode).toBe(201);

    // Now two images (four objects) are held: at the cap.
    const refused = await upload();
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain('limit of 2 uploaded images');
    expect(harness.storedObjects).toHaveLength(4);

    // Someone else's objects never count against this account.
    stored('someone-else', 'x');
    expect((await upload()).statusCode).toBe(409);

    // Deleting one image (both variants) frees a slot.
    harness.storedObjects.splice(
      harness.storedObjects.findIndex((object) => object.key === `portfolio/${id}/one.webp`),
      1,
    );
    harness.storedObjects.splice(
      harness.storedObjects.findIndex((object) => object.key === `portfolio/${id}/one-thumb.webp`),
      1,
    );
    expect((await upload()).statusCode).toBe(201);
  });
});
