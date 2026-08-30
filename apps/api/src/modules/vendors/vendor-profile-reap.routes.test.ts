import { categories, portfolioItems, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The second reap call site.
 *
 * `updateVendorProfile` reaps a profile image or cover the vendor has just
 * replaced, and the invariants it has to hold are not the portfolio delete's:
 *
 * - `vendor_profiles` has **no thumbnail column**, so the `-thumb.webp` sibling
 *   every upload writes is referenced by nothing here and has to be derived or
 *   it is orphaned by every single photo change.
 * - The cover is a *designation on a portfolio tile*, not an upload
 *   (`syncCoverFromPortfolio` copies the tile's key onto the profile). Two
 *   rows, one object. Reaping on the strength of the profile row alone would
 *   destroy an image the vendor still has in their portfolio — a vendor
 *   deleting their own live photo by saving a form.
 *
 * Nothing asserted these until this file existed.
 */
describe('PUT /vendor/profile reaps only what nothing else points at', () => {
  let harness: TestHarness;
  let photographyId: string;

  const VENDOR = 'user_vendor_reap';
  const OTHER_VENDOR = 'user_vendor_reap_two';

  /** The `users.id` the upload route writes into a key for this account. */
  async function ownerIdOf(clerkUserId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));

    if (!row) {
      throw new Error(`No users row for ${clerkUserId}`);
    }
    return row.id;
  }

  /** Puts an object in the bucket the way a real upload would, and returns its key. */
  async function upload(prefix: string, owner: string, name: string): Promise<string> {
    const key = `${prefix}/${owner}/${name}.webp`;
    await harness.app.storage.put(key, Buffer.from(name), 'image/webp');
    await harness.app.storage.put(
      key.replace(/\.webp$/, '-thumb.webp'),
      Buffer.from(`${name}-thumb`),
      'image/webp',
    );
    return key;
  }

  function inBucket(key: string): boolean {
    return harness.storedObjects.some((object) => object.key === key);
  }

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

  async function save(clerkUserId: string, payload: Record<string, unknown>): Promise<void> {
    const response = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(clerkUserId),
      payload,
    });
    expect(response.statusCode).toBe(200);
  }

  async function addPortfolioItem(
    clerkUserId: string,
    imageUrl: string,
    thumbnailUrl: string | null,
  ): Promise<void> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/portfolio',
      headers: bearer(clerkUserId),
      payload: { imageUrl, thumbnailUrl },
    });
    expect(response.statusCode).toBe(201);
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, email] of [
      [VENDOR, 'reap-one@example.com'],
      [OTHER_VENDOR, 'reap-two@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
        firstName: 'Reap',
        lastName: 'Vendor',
        roleHint: 'vendor',
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(portfolioItems);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    // The recorded bucket is shared across tests in this file.
    harness.storedObjects.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reaps a replaced profile image and the thumbnail written beside it', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    const owner = await ownerIdOf(VENDOR);
    const old = await upload('vendor-profile', owner, 'old');
    const replacement = await upload('vendor-profile', owner, 'new');

    await save(VENDOR, { profileImageUrl: old });
    await save(VENDOR, { profileImageUrl: replacement });

    expect(inBucket(old)).toBe(false);
    // No column holds this key, so deriving it is the only way it is ever reaped.
    expect(inBucket(old.replace(/\.webp$/, '-thumb.webp'))).toBe(false);

    // And the image the vendor actually has now is untouched.
    expect(inBucket(replacement)).toBe(true);
    expect(inBucket(replacement.replace(/\.webp$/, '-thumb.webp'))).toBe(true);
  });

  it('reaps nothing when a save leaves the image fields alone', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    const owner = await ownerIdOf(VENDOR);
    const image = await upload('vendor-profile', owner, 'kept');

    await save(VENDOR, { profileImageUrl: image });
    await save(VENDOR, { city: 'Dallas' });

    expect(inBucket(image)).toBe(true);
    expect(inBucket(image.replace(/\.webp$/, '-thumb.webp'))).toBe(true);
  });

  it('re-saving the same key is not a replacement', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    const owner = await ownerIdOf(VENDOR);
    const image = await upload('vendor-profile', owner, 'same');

    await save(VENDOR, { profileImageUrl: image });
    await save(VENDOR, { profileImageUrl: image });

    expect(inBucket(image)).toBe(true);
  });

  /*
   * The cover is a copy of a portfolio tile's key. Reaping it because the
   * profile row moved on would delete a photo the vendor still has — and they
   * would have done it to themselves with a perfectly legal request.
   */
  it('never reaps a cover the vendor still has in their portfolio', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    const owner = await ownerIdOf(VENDOR);
    const tile = await upload('portfolio', owner, 'tile');
    const thumb = tile.replace(/\.webp$/, '-thumb.webp');

    // Adding the tile sets the cover to the same key, via syncCoverFromPortfolio.
    await addPortfolioItem(VENDOR, tile, thumb);

    const standalone = await upload('vendor-cover', owner, 'standalone');
    await save(VENDOR, { coverImageUrl: standalone });

    expect(inBucket(tile)).toBe(true);
    expect(inBucket(thumb)).toBe(true);
  });

  /*
   * The key on a row is client-supplied and every public vendor page hands out
   * the keys it renders, so a vendor can name a rival's key. The owner segment
   * is the only thing that stops the reap acting on it.
   */
  it('never reaps an image minted for another vendor', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    await createProfile(OTHER_VENDOR, 'Rival Studio');
    const rival = await upload('vendor-profile', await ownerIdOf(OTHER_VENDOR), 'rival');
    const mine = await upload('vendor-profile', await ownerIdOf(VENDOR), 'mine');

    await save(VENDOR, { profileImageUrl: rival });
    await save(VENDOR, { profileImageUrl: mine });

    expect(inBucket(rival)).toBe(true);
    expect(inBucket(rival.replace(/\.webp$/, '-thumb.webp'))).toBe(true);
  });

  /*
   * `PUT /users/me` accepts a bare key for `users.avatar_url`, and any
   * authenticated caller may point it at an object they also hold on a vendor
   * row. That column was missing from the reference check, so replacing the
   * vendor profile image deleted the bytes the avatar still renders.
   */
  it('never reaps an image the account avatar still points at', async () => {
    await createProfile(VENDOR, 'Sunlit Studio');
    const owner = await ownerIdOf(VENDOR);
    const shared = await upload('vendor-profile', owner, 'shared');
    const replacement = await upload('vendor-profile', owner, 'later');

    const avatar = await harness.app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: bearer(VENDOR),
      payload: { avatarUrl: shared },
    });
    expect(avatar.statusCode).toBe(200);

    await save(VENDOR, { profileImageUrl: shared });
    await save(VENDOR, { profileImageUrl: replacement });

    expect(inBucket(shared)).toBe(true);
  });
});
