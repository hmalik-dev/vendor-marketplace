import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
