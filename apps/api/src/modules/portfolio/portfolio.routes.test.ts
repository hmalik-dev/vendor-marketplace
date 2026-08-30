import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { reapObjects } from './portfolio.service.js';

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

  /** The `users.id` the upload route would write into a key for this account. */
  async function ownerIdOf(clerkUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));

    return row!.id;
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
      const owner = await ownerIdOf(VENDOR);
      // Owner-shaped, as the upload route mints them — a URL or a legacy
      // two-segment key is deliberately never reaped.
      harness.storedObjects.length = 0;
      const image = `portfolio/${owner}/3333.webp`;
      const thumbnail = `portfolio/${owner}/3333-thumb.webp`;
      const item = await addItem(VENDOR, { imageUrl: image, thumbnailUrl: thumbnail });

      harness.storedObjects.push(
        { key: image, body: Buffer.alloc(0), contentType: 'image/webp' },
        { key: thumbnail, body: Buffer.alloc(0), contentType: 'image/webp' },
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
      const owner = await ownerIdOf(VENDOR);
      const item = await addItem(VENDOR, {
        imageUrl: `portfolio/${owner}/4444.webp`,
        thumbnailUrl: null,
      });

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

    /*
     * The exploit the reap opened, and the reason keys carry their owner.
     *
     * A vendor can read a rival's keys straight off the public
     * `GET /vendors/:slug`, claim them on a row of their own — `imageRefSchema`
     * accepts a bare object key — and delete that row. Without the owner
     * segment, the reap would take the rival's photo with it: permanent, and
     * leaving the victim's own row pointing at a dead key.
     */
    it('never reaps an object minted for a different vendor', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      // A key the attacker did not mint, in the shape the upload route writes.
      harness.storedObjects.length = 0;
      const victimKey = 'portfolio/some-other-user-id/1111.webp';
      const item = await addItem(VENDOR, { imageUrl: victimKey, thumbnailUrl: null });

      harness.storedObjects.push({
        key: victimKey,
        body: Buffer.alloc(0),
        contentType: 'image/webp',
      });

      const response = await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${item.id}`,
        headers: bearer(VENDOR),
      });

      // The attacker's own row goes; the victim's object stays.
      expect(response.statusCode).toBe(204);
      expect(harness.storedObjects.map((object) => object.key)).toEqual([victimKey]);
    });

    /*
     * The cover is a designation on an existing tile, not a second upload —
     * `syncCoverFromPortfolio` copies a tile's key onto the profile. Reaping on
     * the strength of one row would destroy an object the other still points
     * at, and the vendor would have done it to themselves.
     */
    it('never reaps an object another row still references', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      harness.storedObjects.length = 0;
      const shared = `portfolio/${await ownerIdOf(VENDOR)}/2222.webp`;
      const first = await addItem(VENDOR, { imageUrl: shared, thumbnailUrl: null });
      // A second row pointing at the same object, as the cover does.
      await addItem(VENDOR, { imageUrl: shared, thumbnailUrl: null });

      harness.storedObjects.push({ key: shared, body: Buffer.alloc(0), contentType: 'image/webp' });

      await harness.app.inject({
        method: 'DELETE',
        url: `/vendor/portfolio/${first.id}`,
        headers: bearer(VENDOR),
      });

      expect(harness.storedObjects.map((object) => object.key)).toEqual([shared]);
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

/*
 * `reapObjects` documents itself as never throwing, and the delete route relies
 * on that: the row has already committed by the time it runs, so anything
 * raised here would report failure for work that succeeded. The bucket call was
 * guarded from the start; the *reference lookup* is a second round trip and was
 * not. Move either call outside the guard and this fails.
 */
describe('reapObjects survives its own dependencies failing', () => {
  const OWNER = '11111111-1111-4111-8111-111111111111';
  const KEY = `portfolio/${OWNER}/33333333-3333-4333-8333-333333333333.webp`;

  function storageThatRecords(): {
    remove(keys: readonly string[]): Promise<void>;
    removed: string[][];
  } {
    const removed: string[][] = [];
    return {
      removed,
      async remove(keys) {
        removed.push([...keys]);
      },
    };
  }

  it('swallows a failing reference lookup and reaps nothing', async () => {
    const failing = {
      select: () => {
        throw new Error('connection terminated');
      },
    } as never;
    const storage = storageThatRecords();
    const warn = vi.fn();

    await expect(
      reapObjects(failing, storage as never, OWNER, [KEY], { warn }),
    ).resolves.toBeUndefined();

    expect(storage.removed).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toBe('Could not reap storage objects');
    expect((warn.mock.calls[0]?.[0] as { keys: string[] }).keys).toEqual([KEY]);
  });

  /* No owned key means no round trip at all, so nothing can fail. */
  it('does not touch the database for a key it does not own', async () => {
    const select = vi.fn();
    const storage = storageThatRecords();

    await reapObjects({ select } as never, storage as never, OWNER, [
      'portfolio/22222222-2222-4222-8222-222222222222/x.webp',
    ]);

    expect(select).not.toHaveBeenCalled();
    expect(storage.removed).toEqual([]);
  });
});
