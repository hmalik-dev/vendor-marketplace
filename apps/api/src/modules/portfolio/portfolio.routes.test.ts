import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const IMAGE_URL = 'http://cdn.test/portfolio/one.webp';
const THUMBNAIL_URL = 'http://cdn.test/portfolio/one-thumb.webp';

describe('/vendor/portfolio', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function createProfile(clerkUserId: string, businessName: string): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
      payload: {
        businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography.',
      },
    });
    expect(response.statusCode).toBe(201);
  }

  async function addItem(
    clerkUserId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; displayOrder: number; caption: string | null }> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/portfolio',
      headers: bearer(clerkUserId),
      payload: { imageUrl: IMAGE_URL, thumbnailUrl: THUMBNAIL_URL, ...overrides },
    });

    expect(response.statusCode).toBe(201);
    return response.json();
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('authorization', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/vendor/portfolio' });

      expect(response.statusCode).toBe(401);
    });

    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/portfolio',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST', () => {
    it('stores the item and answers 201 with its location', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/portfolio',
        headers: bearer(VENDOR),
        payload: { imageUrl: IMAGE_URL, thumbnailUrl: THUMBNAIL_URL, caption: 'Golden hour' },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(response.headers.location).toBe(`/vendor/portfolio/${body.id}`);
      expect(body.imageUrl).toBe(IMAGE_URL);
      expect(body.thumbnailUrl).toBe(THUMBNAIL_URL);
      expect(body.caption).toBe('Golden hour');
      expect(body.displayOrder).toBe(0);
    });

    it('rejects a caption-only body with no image', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/portfolio',
        headers: bearer(VENDOR),
        payload: { caption: 'Golden hour' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('appends each new photo after the last one', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      expect((await addItem(VENDOR)).displayOrder).toBe(0);
      expect((await addItem(VENDOR)).displayOrder).toBe(1);
    });
  });

  describe('GET', () => {
    it('returns only the caller’s own photos', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      await addItem(VENDOR, { caption: 'Mine' });
      await addItem(OTHER_VENDOR, { caption: 'Theirs' });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/portfolio',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: { caption: string }) => row.caption)).toEqual(['Mine']);
    });
  });

  describe('PATCH /:itemId', () => {
    it('updates the caption', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const item = await addItem(VENDOR, { caption: 'Golden hour' });

      const response = await harness.app.inject({
        method: 'PATCH',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
        payload: { caption: 'First dance' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().caption).toBe('First dance');
    });

    it('stores a cleared caption as null rather than an empty string', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const item = await addItem(VENDOR, { caption: 'Golden hour' });

      const response = await harness.app.inject({
        method: 'PATCH',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
        payload: { caption: '' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().caption).toBeNull();
    });

    it('answers 404 for another vendor’s photo', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      const theirs = await addItem(OTHER_VENDOR);

      const response = await harness.app.inject({
        method: 'PATCH',
        url: `/vendor/portfolio/${theirs.id}`,
        headers: bearer(VENDOR),
        payload: { caption: 'Mine now' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /:itemId', () => {
    it('removes the photo and answers 204', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const item = await addItem(VENDOR);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(204);

      const remaining = await harness.app.inject({
        method: 'GET',
        url: '/vendor/portfolio',
        headers: bearer(VENDOR),
      });
      expect(remaining.json()).toEqual([]);
    });

    /*
     * #178. The row and the objects behind it used to part company: the delete
     * removed the row and deliberately left the WebP and its thumbnail in the
     * bucket forever. That reasoning leaned on the keys being unguessable, and
     * the bucket turned out to enumerate them (#180) — so the objects go too.
     */
    it('removes the stored objects, not only the row', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const item = await addItem(VENDOR);

      harness.storedObjects.push(
        { key: IMAGE_URL, body: Buffer.alloc(0), contentType: 'image/webp' },
        { key: THUMBNAIL_URL, body: Buffer.alloc(0), contentType: 'image/webp' },
      );

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(204);
      expect(harness.storedObjects.map((object) => object.key)).toEqual([]);
    });

    /*
     * The row is the source of truth and it has already committed, so a bucket
     * that blinks must not turn a delete the vendor watched succeed into a 500.
     * One orphan is recoverable by a sweep; a failed delete is not.
     */
    it('still answers 204 when the object store refuses the reap', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const item = await addItem(VENDOR);

      const remove = vi
        .spyOn(harness.app.storage, 'remove')
        .mockRejectedValue(new Error('bucket unreachable'));

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(204);
      expect(remove).toHaveBeenCalled();
      remove.mockRestore();

      // And the row is gone, which is what the vendor was told.
      const remaining = await harness.app.inject({
        method: 'GET',
        url: '/vendor/portfolio',
        headers: bearer(VENDOR),
      });
      expect(remaining.json()).toEqual([]);
    });

    it('answers 404 for a photo that does not exist', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${UNKNOWN_ID}`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(404);
    });

    it('refuses to delete another vendor’s photo', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      const theirs = await addItem(OTHER_VENDOR);

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${theirs.id}`,
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(404);

      const stillThere = await harness.app.inject({
        method: 'GET',
        url: '/vendor/portfolio',
        headers: bearer(OTHER_VENDOR),
      });
      expect(stillThere.json()).toHaveLength(1);
    });
  });

  describe('PUT /reorder', () => {
    it('rewrites every position from the submitted order', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await addItem(VENDOR, { caption: 'First' });
      const second = await addItem(VENDOR, { caption: 'Second' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/portfolio/reorder',
        headers: bearer(VENDOR),
        payload: { itemIds: [second.id, first.id] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: { caption: string }) => row.caption)).toEqual([
        'Second',
        'First',
      ]);
      expect(response.json().map((row: { displayOrder: number }) => row.displayOrder)).toEqual([
        0, 1,
      ]);
    });

    it('rejects an order that leaves a photo out', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await addItem(VENDOR);
      await addItem(VENDOR);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/portfolio/reorder',
        headers: bearer(VENDOR),
        payload: { itemIds: [first.id] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Send every one of your photos in the new order.');
    });
  });
});

/**
 * "Cover is a designation on an existing tile (drag to first slot), never a
 * second uploader" — `40-states.md`. The cover stays a stored column, so what
 * matters is that the column and the list can never disagree.
 */
describe('the cover follows the first portfolio photo', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function coverOf(clerkUserId: string): Promise<string | null> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    return response.json().coverImageUrl as string | null;
  }

  async function add(clerkUserId: string, imageUrl: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/portfolio',
      headers: bearer(clerkUserId),
      payload: { imageUrl, thumbnailUrl: `${imageUrl}-thumb` },
    });
    expect(response.statusCode).toBe(201);

    return response.json().id as string;
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.clerkUsers.set(VENDOR, {
      clerkUserId: VENDOR,
      email: 'cover@example.com',
      firstName: 'Cover',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function profile(): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Cover Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography.',
      },
    });
    expect(response.statusCode).toBe(201);
  }

  /* Otherwise a vendor has a portfolio and no banner until they reorder a list of one. */
  it('adopts the first photo uploaded as the cover', async () => {
    await profile();
    await add(VENDOR, 'http://cdn.test/portfolio/first.webp');

    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/first.webp');
  });

  it('leaves the cover alone when a second photo goes on the end', async () => {
    await profile();
    await add(VENDOR, 'http://cdn.test/portfolio/first.webp');
    await add(VENDOR, 'http://cdn.test/portfolio/second.webp');

    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/first.webp');
  });

  /* The designation *is* the drag: first slot means cover. */
  it('moves the cover when a photo is dragged into first place', async () => {
    await profile();
    const first = await add(VENDOR, 'http://cdn.test/portfolio/first.webp');
    const second = await add(VENDOR, 'http://cdn.test/portfolio/second.webp');

    const response = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/portfolio/reorder',
      headers: bearer(VENDOR),
      payload: { itemIds: [second, first] },
    });
    expect(response.statusCode).toBe(200);

    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/second.webp');
  });

  it('promotes the next photo when the cover is deleted', async () => {
    await profile();
    const first = await add(VENDOR, 'http://cdn.test/portfolio/first.webp');
    await add(VENDOR, 'http://cdn.test/portfolio/second.webp');

    const response = await harness.app.inject({
      method: 'DELETE',
      url: `/vendor/portfolio/${first}`,
      headers: bearer(VENDOR),
    });
    expect(response.statusCode).toBe(204);

    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/second.webp');
  });

  /* An empty portfolio means no cover. The profile has a placeholder for it. */
  it('clears the cover when the last photo goes', async () => {
    await profile();
    const only = await add(VENDOR, 'http://cdn.test/portfolio/only.webp');

    await harness.app.inject({
      method: 'DELETE',
      url: `/vendor/portfolio/${only}`,
      headers: bearer(VENDOR),
    });

    expect(await coverOf(VENDOR)).toBeNull();
  });

  /*
   * The acceptance criterion: order and cover are one write. A reorder that
   * names a photo the vendor does not own is refused, and must leave the
   * order and the cover exactly as they were — not one of the two.
   */
  it('changes neither the order nor the cover when the reorder is refused', async () => {
    await profile();
    const first = await add(VENDOR, 'http://cdn.test/portfolio/first.webp');
    const second = await add(VENDOR, 'http://cdn.test/portfolio/second.webp');

    const refused = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/portfolio/reorder',
      headers: bearer(VENDOR),
      payload: { itemIds: [second, UNKNOWN_ID] },
    });
    expect(refused.statusCode).toBeGreaterThanOrEqual(400);

    const listed = await harness.app.inject({
      method: 'GET',
      url: '/vendor/portfolio',
      headers: bearer(VENDOR),
    });
    expect(listed.json().map((item: { id: string }) => item.id)).toEqual([first, second]);
    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/first.webp');
  });

  it('is unchanged by two reorders in a row', async () => {
    await profile();
    const first = await add(VENDOR, 'http://cdn.test/portfolio/first.webp');
    const second = await add(VENDOR, 'http://cdn.test/portfolio/second.webp');

    for (const order of [
      [second, first],
      [first, second],
    ]) {
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/portfolio/reorder',
        headers: bearer(VENDOR),
        payload: { itemIds: order },
      });
      expect(response.statusCode).toBe(200);
    }

    expect(await coverOf(VENDOR)).toBe('http://cdn.test/portfolio/first.webp');
  });
});
