import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { addDays } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { NEW_VENDOR_WINDOW_DAYS } from './vendor-recency.js';

/**
 * The `New` badge answers against the **instance clock**, not the wall clock.
 *
 * Its own file because the assertion needs a harness whose clock is pinned far
 * from real time, and `vendor-search.routes.test.ts` deliberately runs on the
 * real one — the whole suite would move with it.
 *
 * `plugins/clock.ts` exists because "now" was once decided in two places that
 * did not have to agree. `isNew` was written with a `new Date()` inside the DAO
 * and crossed that rule: it passed every relative fixture, because a relative
 * fixture moves with whichever clock is read. This pins one and asks the other,
 * which is the only shape of check that can tell them apart.
 */
describe('GET /vendors — the New badge reads the instance clock', () => {
  let harness: TestHarness;
  let photographyId: string;

  /**
   * Well past the window from *any* moment a test run could start, so a badge
   * computed from `new Date()` says `true` while one computed from the pinned
   * clock says `false`. The vendor's row is written at the real now.
   */
  const PINNED_NOW = addDays(new Date(), NEW_VENDOR_WINDOW_DAYS * 10);

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => PINNED_NOW });
    harness.clerkUsers.set('user_a', {
      clerkUserId: 'user_a',
      email: 'user_a@example.com',
      firstName: 'Test',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
  });

  afterAll(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    await harness.close();
  });

  it('calls a vendor created now old, when the instance clock is past the window', async () => {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer('user_a'),
      payload: {
        businessName: 'Joined Today',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Joined Today does good work.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    // Publishing is blocked without an active package — `publishBlockers`.
    const pkg = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer('user_a'),
      payload: {
        name: 'Full day',
        description: 'A package with a description long enough to pass validation.',
        priceCents: 150_000,
      },
    });
    expect(pkg.statusCode).toBe(201);

    const published = await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer('user_a'),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);

    const response = await harness.app.inject({ method: 'GET', url: '/vendors' });
    expect(response.statusCode).toBe(200);

    // `new Date()` in the DAO would answer `true` here — the row really was
    // written moments ago. The pinned clock is the one that must decide.
    expect(response.json().items[0]).toMatchObject({
      businessName: 'Joined Today',
      isNew: false,
    });
  });
});
