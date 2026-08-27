import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * The public profile is the page where the decision happens, and three shipped
 * surfaces link straight to it. These drive the real route: what a visitor is
 * shown, and — as importantly — what they are not.
 */
describe('GET /vendors/:slug', () => {
  let harness: TestHarness;
  let photographyId: string;

  interface VendorSpec {
    user: string;
    businessName: string;
    prices?: number[];
    publish?: boolean;
    inactivePrice?: number;
  }

  async function seedVendor(spec: VendorSpec): Promise<{ id: string; slug: string }> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(spec.user),
      payload: {
        businessName: spec.businessName,
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: `${spec.businessName} does good work.`,
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();

    for (const priceCents of spec.prices ?? [150_000]) {
      const pkg = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(spec.user),
        payload: {
          name: `Package ${priceCents}`,
          description: 'A package with a description long enough to pass validation.',
          priceCents,
        },
      });
      expect(pkg.statusCode).toBe(201);
    }

    if (spec.publish !== false) {
      const published = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(spec.user),
        payload: { isPublished: true },
      });
      expect(published.statusCode).toBe(200);
    }

    return { id: body.id as string, slug: body.slug as string };
  }

  const VENDOR_USERS = [
    'vendor-a',
    'vendor-b',
    'vendor-c',
    'vendor-d',
    'vendor-e',
    'vendor-f',
    'vendor-g',
  ];

  /** A `YYYY-MM-DD` date `days` from today, inside the availability window. */
  function futureDate(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const clerkUserId of VENDOR_USERS) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'Vendor',
        roleHint: 'vendor',
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'photography'));
    photographyId = rows[0]!.id;
  });

  // Reference data (the taxonomy) is seeded once and must survive; only the
  // rows each test creates are cleared.
  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns the published profile a visitor asked for', async () => {
    const { slug } = await seedVendor({ user: 'vendor-a', businessName: 'Kessler and Co' });

    const response = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });

    expect(response.statusCode).toBe(200);
    const profile = response.json();
    expect(profile.businessName).toBe('Kessler and Co');
    expect(profile.city).toBe('Austin');
    expect(profile.categories).toHaveLength(1);
    expect(profile.categories[0].slug).toBe('photography');
  });

  it('carries the cheapest active package as the rail price', async () => {
    const { slug } = await seedVendor({
      user: 'vendor-b',
      businessName: 'Bright Room',
      prices: [400_000, 145_000, 250_000],
    });

    const profile = (await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` })).json();

    expect(profile.startingPriceCents).toBe(145_000);
    expect(profile.packages).toHaveLength(3);
  });

  /*
   * An unpublished profile is a draft and a deleted one is gone. Both answer
   * 404 rather than 403, so the endpoint cannot be used to discover which
   * slugs exist as drafts.
   */
  it('hides an unpublished profile behind a 404', async () => {
    const { slug } = await seedVendor({
      user: 'vendor-c',
      businessName: 'Not Live Yet',
      publish: false,
    });

    const response = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });

    expect(response.statusCode).toBe(404);
  });

  it('hides a deleted profile behind a 404', async () => {
    const { id, slug } = await seedVendor({ user: 'vendor-d', businessName: 'Gone Away' });

    await harness.database.db
      .update(vendorProfiles)
      .set({ isDeleted: true })
      .where(eq(vendorProfiles.id, id));

    const response = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for a slug that never existed', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendors/no-such-vendor' });

    expect(response.statusCode).toBe(404);
  });

  it('rejects a slug the column could not hold before it reaches the database', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendors/Not%20A%20Slug' });

    expect(response.statusCode).toBe(400);
  });

  /*
   * The public shape is built by naming what is public, not by omitting what is
   * not — so this asserts the private columns are absent. A profile that leaks
   * `stripeAccountId` leaks it to everyone who can read a vendor page.
   */
  it('never exposes the private columns of a profile', async () => {
    const { slug } = await seedVendor({ user: 'vendor-e', businessName: 'Private Parts' });

    const profile = (await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` })).json();

    for (const key of [
      'userId',
      'stripeAccountId',
      'stripeOnboarded',
      'address',
      'latitude',
      'longitude',
      'isDeleted',
    ]) {
      expect(profile, key).not.toHaveProperty(key);
    }
  });

  it('reports no completed events for a vendor who has taken no bookings', async () => {
    const { slug } = await seedVendor({ user: 'vendor-f', businessName: 'Brand New' });

    const profile = (await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` })).json();

    expect(profile.completedEventCount).toBe(0);
  });

  describe('GET /vendors/:slug/availability', () => {
    it('returns the dates the vendor has set, and nothing for the rest', async () => {
      const { slug } = await seedVendor({ user: 'vendor-a', businessName: 'Calendar Co' });

      const blocked = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/availability',
        headers: bearer('vendor-a'),
        payload: { entries: [{ date: futureDate(30), status: 'blocked' }] },
      });
      expect(blocked.statusCode).toBe(200);

      const response = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/availability`,
      });

      expect(response.statusCode).toBe(200);
      const entries = response.json();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe('blocked');
      expect(entries[0].date).toBe(futureDate(30));
    });

    /*
     * The calendar must answer 404 for the same vendors the profile hides —
     * otherwise it becomes a way to ask questions about an unpublished draft.
     */
    it('hides an unpublished calendar behind a 404', async () => {
      const { slug } = await seedVendor({
        user: 'vendor-b',
        businessName: 'Still Drafting',
        publish: false,
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: `/vendors/${slug}/availability`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('answers 404 for a slug that never existed', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendors/no-such-vendor/availability',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  it('is readable without a token, because discovery cannot need an account', async () => {
    const { slug } = await seedVendor({ user: 'vendor-g', businessName: 'Open House' });

    const response = await harness.app.inject({ method: 'GET', url: `/vendors/${slug}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().slug).toBe(slug);
  });
});
