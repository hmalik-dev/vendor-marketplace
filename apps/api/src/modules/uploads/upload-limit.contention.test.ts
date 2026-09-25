import { users } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countOwnedImages } from '../../lib/storage.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const LIMIT = 3;
const BOUNDARY = '----vendormarketplacetestboundary';
const MULTIPART_HEADERS = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };
// What a bucket listing costs over the network, so concurrent requests really
// overlap between their count and their write.
const LIST_LATENCY_MS = 25;

/**
 * VEN-625 — the half PGlite cannot prove. Every upload counts the account's
 * images and then writes one; on one connection the requests never overlap,
 * so a suite there passes with the lock deleted. Here each upload holds its own
 * pooled connection, and the listing yields long enough for all of them to
 * count before any of them writes.
 */
describe('the upload cap under concurrent uploads', () => {
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let payload: Buffer;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 12 });
    harness = await createTestHarness({
      database,
      env: { UPLOAD_OBJECT_LIMIT: LIMIT, UPLOAD_RATE_LIMIT_MAX: 100 },
    });

    const storage = harness.app.storage;
    const list = storage.list;
    storage.list = async (prefix, page) => {
      await new Promise((resolve) => setTimeout(resolve, LIST_LATENCY_MS));
      return list(prefix, page);
    };

    const jpeg = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    payload = Buffer.concat([
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      jpeg,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ]);
  });

  afterAll(async () => {
    if (harness) {
      await harness.database.db.delete(users);
      await harness.close();
    } else {
      await database?.close();
    }
  });

  async function signIn(authUserId: string): Promise<string> {
    harness!.authUsers.set(authUserId, {
      authUserId,
      email: `${authUserId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'vendor',
      avatarUrl: null,
    });
    const me = await harness!.app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: bearer(authUserId),
    });
    expect(me.statusCode).toBe(200);

    return me.json().id;
  }

  async function upload(authUserId: string): Promise<number> {
    const response = await harness!.app.inject({
      method: 'POST',
      url: '/v1/upload/image?prefix=portfolio',
      headers: { ...MULTIPART_HEADERS, ...bearer(authUserId) },
      payload,
    });

    return response.statusCode;
  }

  it('lets exactly one of ten concurrent uploads take the last slot', async () => {
    const vendor = 'user_cap_concurrent';
    const id = await signIn(vendor);

    for (const name of ['one', 'two']) {
      for (const key of [`portfolio/${id}/${name}.webp`, `portfolio/${id}/${name}-thumb.webp`]) {
        harness!.storedObjects.push({ key, body: Buffer.from('x'), contentType: 'image/webp' });
      }
    }
    expect(await countOwnedImages(harness!.app.storage, id, Infinity)).toBe(2);

    const statuses = await Promise.all(Array.from({ length: 10 }, () => upload(vendor)));

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(9);
    expect(await countOwnedImages(harness!.app.storage, id, Infinity)).toBe(LIMIT);
  });

  it('still admits uploads one to three in sequence and refuses the fourth', async () => {
    const vendor = 'user_cap_sequential';
    const id = await signIn(vendor);
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push(await upload(vendor));
    }

    expect(statuses).toEqual([201, 201, 201, 409]);
    expect(await countOwnedImages(harness!.app.storage, id, Infinity)).toBe(LIMIT);
  });
});
