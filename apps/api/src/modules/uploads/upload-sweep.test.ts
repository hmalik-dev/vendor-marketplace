import { portfolioItems, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { UPLOAD_ORPHAN_GRACE_MS } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { sweepOrphanedUploads } from './upload-sweep.service.js';

const NOW = new Date('2026-09-20T12:00:00Z');
const OLD = new Date(NOW.getTime() - UPLOAD_ORPHAN_GRACE_MS - 60_000);
const FRESH = new Date(NOW.getTime() - 60_000);
const OWNER = 'a0000000-0000-4000-8000-000000000001';

const ORPHAN = `portfolio/${OWNER}/orphan.webp`;
const ORPHAN_THUMB = `portfolio/${OWNER}/orphan-thumb.webp`;
const REFERENCED = `customer-profile/${OWNER}/avatar.webp`;
const REFERENCED_THUMB = `customer-profile/${OWNER}/avatar-thumb.webp`;
const BY_URL = `vendor-cover/${OWNER}/legacy.webp`;
const FRESH_ORPHAN = `portfolio/${OWNER}/fresh.webp`;

describe('sweepOrphanedUploads', () => {
  let harness: TestHarness;

  function stored(): string[] {
    return harness.storedObjects.map((object) => object.key).sort();
  }

  function put(key: string, lastModified: Date): void {
    harness.storedObjects.push({
      key,
      body: Buffer.from('x'),
      contentType: 'image/webp',
      lastModified,
    });
  }

  function sweep(dryRun = false): ReturnType<typeof sweepOrphanedUploads> {
    return sweepOrphanedUploads(
      { db: harness.database.db, storage: harness.app.storage, log: harness.app.log },
      NOW,
      { dryRun },
    );
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.database.db.insert(users).values({
      id: OWNER,
      authUserId: 'user_sweep',
      email: 'sweep@example.com',
      role: 'customer',
      firstName: 'Sam',
      lastName: 'Lee',
      avatarUrl: REFERENCED,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  function seed(): void {
    harness.storedObjects.length = 0;
    put(ORPHAN, OLD);
    put(ORPHAN_THUMB, OLD);
    put(REFERENCED, OLD);
    put(REFERENCED_THUMB, OLD);
    put(FRESH_ORPHAN, FRESH);
  }

  it('deletes an old unreferenced object and keeps a referenced one, its thumbnail and a fresh one', async () => {
    seed();

    const result = await sweep();

    expect(result).toEqual({ ran: true, scanned: 5, orphaned: 2 });
    expect(stored()).toEqual([FRESH_ORPHAN, REFERENCED, REFERENCED_THUMB].sort());
  });

  it('keeps an object a row names by absolute URL', async () => {
    seed();
    put(BY_URL, OLD);
    await harness.database.db.update(users).set({ avatarUrl: `http://cdn.test/${BY_URL}` });

    await sweep();

    expect(stored()).toContain(BY_URL);
    await harness.database.db.update(users).set({ avatarUrl: REFERENCED });
  });

  it.each([
    ['a query string', `${BY_URL}?v=2`],
    ['an escaped slash', BY_URL.replace('/', '%2F')],
    ['a backslash', BY_URL.replace('/', '\\')],
    ['a dot segment', BY_URL.replace('/', '/./')],
  ])('keeps an object a row names with %s', async (_label, spelling) => {
    seed();
    put(BY_URL, OLD);
    await harness.database.db.update(users).set({ avatarUrl: spelling });

    await sweep();

    expect(stored()).toContain(BY_URL);
    await harness.database.db.update(users).set({ avatarUrl: REFERENCED });
  });

  it('reads every page of a listing, not only the first', async () => {
    seed();
    const pages: (string | undefined)[] = [];
    const paged = {
      ...harness.app.storage,
      list: async (prefix: string, page?: { limit?: number; token?: string }) => {
        pages.push(page?.token);
        return harness.app.storage.list(prefix, {
          limit: 1,
          ...(page?.token ? { token: page.token } : {}),
        });
      },
    };

    const result = await sweepOrphanedUploads(
      { db: harness.database.db, storage: paged, log: harness.app.log },
      NOW,
    );

    expect(result).toEqual({ ran: true, scanned: 5, orphaned: 2 });
    expect(pages.filter((token) => token !== undefined).length).toBeGreaterThan(0);
    expect(stored()).toEqual([FRESH_ORPHAN, REFERENCED, REFERENCED_THUMB].sort());
  });

  /*
   * VEN-614: a closed account's rows stay for the money, and their image
   * columns with them. Counted as live, those references kept a closed
   * vendor's photos public forever and gave a failed closure delete nothing to
   * retry it; ignored, the sweep finishes what the closure started.
   */
  it('deletes objects that only a closed account still names', async () => {
    const closedId = 'a0000000-0000-4000-8000-000000000002';
    const avatar = `customer-profile/${closedId}/avatar.webp`;
    const profile = `vendor-profile/${closedId}/face.webp`;
    const cover = `vendor-cover/${closedId}/cover.webp`;
    const portfolio = `portfolio/${closedId}/work.webp`;
    const portfolioThumb = `portfolio/${closedId}/work-thumb.webp`;

    await harness.database.db.insert(users).values({
      id: closedId,
      authUserId: 'user_sweep_closed',
      email: 'sweep-closed@example.com',
      role: 'vendor',
      firstName: 'Cam',
      lastName: 'Ray',
      avatarUrl: avatar,
      deletedAt: NOW,
    });
    const [vendor] = await harness.database.db
      .insert(vendorProfiles)
      .values({
        userId: closedId,
        businessName: 'Closed Studio',
        slug: 'closed-studio-sweep',
        profileImageUrl: profile,
        coverImageUrl: cover,
        isDeleted: true,
      })
      .returning({ id: vendorProfiles.id });
    await harness.database.db
      .insert(portfolioItems)
      .values({ vendorId: vendor!.id, imageUrl: portfolio, thumbnailUrl: portfolioThumb });

    seed();
    for (const key of [avatar, profile, cover, portfolio, portfolioThumb]) {
      put(key, OLD);
    }

    const result = await sweep();

    expect(result).toEqual({ ran: true, scanned: 10, orphaned: 7 });
    expect(stored()).toEqual([FRESH_ORPHAN, REFERENCED, REFERENCED_THUMB].sort());

    await harness.database.db.delete(portfolioItems);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users).where(eq(users.id, closedId));
  });

  it('under dry run deletes nothing and reports what it would have', async () => {
    seed();

    const result = await sweep(true);

    expect(result).toEqual({ ran: true, scanned: 5, orphaned: 2 });
    expect(stored()).toHaveLength(5);
  });
});
