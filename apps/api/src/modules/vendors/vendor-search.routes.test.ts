import { categories, servicePackages, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { ERROR_CODES, MAX_PAGE } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * Search is the front door, so these drive the real route rather than the DAO:
 * a filter that works in isolation but is dropped by the querystring schema is
 * still a broken search.
 */
describe('GET /vendors', () => {
  let harness: TestHarness;
  let photographyId: string;
  let cateringId: string;

  interface VendorSpec {
    user: string;
    businessName: string;
    city?: string;
    state?: string;
    categoryIds?: string[];
    prices?: number[];
    rating?: number;
    reviewCount?: number;
    publish?: boolean;
    blockedDates?: string[];
  }

  /** Creates a vendor through the real routes, then publishes it. */
  async function seedVendor(spec: VendorSpec): Promise<string> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(spec.user),
      payload: {
        businessName: spec.businessName,
        categoryIds: spec.categoryIds ?? [photographyId],
        city: spec.city ?? 'Austin',
        state: spec.state ?? 'TX',
        bio: `${spec.businessName} does good work.`,
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);
    const vendorId = created.json().id as string;

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

    if (spec.blockedDates?.length) {
      const blocked = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/availability',
        headers: bearer(spec.user),
        payload: { entries: spec.blockedDates.map((date) => ({ date, status: 'blocked' })) },
      });
      expect(blocked.statusCode).toBe(200);
    }

    // Ratings are derived columns no endpoint may write, so the fixture sets
    // them directly rather than pretending an endpoint exists.
    if (spec.rating !== undefined || spec.reviewCount !== undefined) {
      await harness.database.db
        .update(vendorProfiles)
        .set({
          ...(spec.rating !== undefined ? { avgRating: spec.rating.toFixed(2) } : {}),
          ...(spec.reviewCount !== undefined ? { reviewCount: spec.reviewCount } : {}),
        })
        .where(eq(vendorProfiles.id, vendorId));
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

    return vendorId;
  }

  async function search(query = ''): Promise<{
    items: Array<{ businessName: string; startingPriceCents: number | null }>;
    total: number;
    facets: { categories: Array<{ categoryId: string; count: number }> };
    page: number;
    pageSize: number;
  }> {
    const response = await harness.app.inject({ method: 'GET', url: `/vendors${query}` });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  const names = (items: Array<{ businessName: string }>): string[] =>
    items.map((item) => item.businessName);

  /** Every vendor the fixtures may sign in as. */
  const VENDOR_USERS = ['user_a', 'user_b', 'user_c', 'user_d'] as const;

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

    const rows = await harness.database.db.select().from(categories);
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
    cateringId = rows.find((row) => row.slug === 'catering')!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns an empty page rather than an error when nothing matches', async () => {
    const body = await search();

    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });

  it('needs no account — discovery is the front door', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });

    const response = await harness.app.inject({ method: 'GET', url: '/vendors' });

    expect(response.statusCode).toBe(200);
    expect(names(response.json().items)).toEqual(['Kessler & Co.']);
  });

  it('shows only published vendors', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Published' });
    await seedVendor({ user: 'user_b', businessName: 'Draft', publish: false });

    expect(names((await search()).items)).toEqual(['Published']);
  });

  it('hides a vendor that unpublishes', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer('user_a'),
      payload: { isPublished: false },
    });

    expect((await search()).total).toBe(0);
  });

  it('carries the cheapest active package as the from-price', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.', prices: [240_000, 98_000] });

    expect((await search()).items[0]?.startingPriceCents).toBe(98_000);
  });

  /*
   * Publishing requires a bookable package and deactivating the last one
   * unpublishes, so a published vendor with no active package cannot be reached
   * through the routes. The database does not enforce that invariant, though,
   * and a read path that divides by it would take the whole search down — so
   * the row is written directly here to prove the null survives to the card as
   * "no price yet" rather than as a crash.
   */
  it('survives a published vendor with no active package', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await harness.database.db.delete(servicePackages);

    const body = await search();
    expect(names(body.items)).toEqual(['Kessler & Co.']);
    expect(body.items[0]?.startingPriceCents).toBeNull();
  });

  it('filters by category slug', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Photographer' });
    await seedVendor({ user: 'user_b', businessName: 'Caterer', categoryIds: [cateringId] });

    expect(names((await search('?category=catering')).items)).toEqual(['Caterer']);
  });

  it('matches city case-insensitively, the way a person types it', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Austin', city: 'Austin' });
    await seedVendor({ user: 'user_b', businessName: 'Dallas', city: 'Dallas' });

    expect(names((await search('?city=austin')).items)).toEqual(['Austin']);
  });

  /*
   * `state` had no test at all, which is how it reached production 500ing on
   * every request that used it. #332 made the column the `us_state` enum and
   * the predicate still called `lower()` on it, so Postgres answered
   * `function lower(us_state) does not exist` — and because the search UI always
   * sends `city` and `state` as a pair, the canonical results URL was a 500 for
   * every visitor. These three assert the filter, its case-insensitivity and the
   * unknown-value case, which is the one a bare `eq()` on the enum would break.
   */
  it('filters by state', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Texan', city: 'Austin', state: 'TX' });
    await seedVendor({ user: 'user_b', businessName: 'Oregonian', city: 'Portland', state: 'OR' });

    expect(names((await search('?state=TX')).items)).toEqual(['Texan']);
  });

  it('matches state case-insensitively, and pairs with city the way the app sends it', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Texan', city: 'Austin', state: 'TX' });

    expect(names((await search('?state=tx')).items)).toEqual(['Texan']);
    expect(names((await search('?city=Austin&state=TX')).items)).toEqual(['Texan']);
  });

  it('returns no rows for a state outside the vocabulary rather than failing', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Texan', city: 'Austin', state: 'TX' });

    const body = await search('?state=ZZ');

    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  /*
   * Name search is the referral case only — someone was handed a business card.
   * It is deliberately narrow: business name, nothing else. Matching the bio
   * too would make it a general text query, which is the thing decision D6
   * removed from the main path.
   */
  it('matches the business name case-insensitively and partially', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    expect(names((await search('?name=kessler')).items)).toEqual(['Kessler & Co.']);
    expect(names((await search('?name=ROWE')).items)).toEqual(['Delaney Rowe']);
  });

  it('does not match the bio — name search is the business name alone', async () => {
    // seedVendor writes the bio as `<businessName> does good work.`, so "does"
    // appears in every bio and in no business name.
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    expect((await search('?name=does')).items).toEqual([]);
  });

  it('returns everything for a name that is only whitespace', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    expect(names((await search('?name=%20%20')).items)).toEqual(['Delaney Rowe', 'Kessler & Co.']);
  });

  /*
   * `%` and `_` are LIKE syntax. Unescaped, `?name=%` matched every row and
   * dumped the whole directory, and a business whose name contains one could
   * never be found literally. Both directions are asserted here.
   */
  it('treats LIKE wildcards in a name search as literal characters', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    expect((await search('?name=%25')).items).toEqual([]);
    expect((await search('?name=_')).items).toEqual([]);
  });

  it('finds a business whose name literally contains a wildcard character', async () => {
    await seedVendor({ user: 'user_a', businessName: '100% Film Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    expect(names((await search('?name=100%25')).items)).toEqual(['100% Film Co.']);
  });

  /*
   * The web layer strips a past date before it ever reaches here, but the
   * endpoint is public and #7 books against the same field. An empty result
   * set would read as "no vendors are free", which is a different and wrong
   * answer to "that day has gone".
   */
  it('rejects an event date that has already passed', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendors?date=2020-01-01' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400 });
  });

  it('accepts an event date in the future', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });

    expect(names((await search('?date=2099-06-01')).items)).toEqual(['Kessler & Co.']);
  });

  it('ignores a free-text q rather than filtering on it', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.' });
    await seedVendor({ user: 'user_b', businessName: 'Delaney Rowe' });

    // The old main-path query parameter. It is no longer part of the contract,
    // so a stale bookmark carrying it returns the unfiltered set instead of an
    // error or an empty grid.
    expect((await search('?q=kessler')).items).toHaveLength(2);
  });

  /*
   * Price matches when ANY active package falls in range, not only the
   * cheapest: a vendor whose mid-tier is what was searched for is a real answer.
   */
  it('matches on any active package falling inside the price range', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Spread', prices: [50_000, 400_000] });
    await seedVendor({ user: 'user_b', businessName: 'Cheap', prices: [50_000] });

    expect(names((await search('?minPriceCents=300000')).items)).toEqual(['Spread']);
  });

  it('applies both ends of the price range', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Under', prices: [40_000] });
    await seedVendor({ user: 'user_b', businessName: 'Inside', prices: [150_000] });
    await seedVendor({ user: 'user_c', businessName: 'Over', prices: [900_000] });

    const body = await search('?minPriceCents=100000&maxPriceCents=200000');
    expect(names(body.items)).toEqual(['Inside']);
  });

  it('rejects a price range that is inside out', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/vendors?minPriceCents=900000&maxPriceCents=1000',
    });

    expect(response.statusCode).toBe(400);
  });

  it('filters by minimum rating', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Great', rating: 4.9, reviewCount: 40 });
    await seedVendor({ user: 'user_b', businessName: 'Fine', rating: 3.8, reviewCount: 40 });

    expect(names((await search('?minRating=4.5')).items)).toEqual(['Great']);
  });

  /*
   * A date filter asks who can actually do the day. A date with no row is
   * available, which is why it is an exclusion rather than a join.
   */
  it('excludes vendors whose calendar is blocked on the requested date', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Free' });
    await seedVendor({ user: 'user_b', businessName: 'Away', blockedDates: ['2099-06-14'] });

    const body = await search('?date=2099-06-14');
    expect(names(body.items)).toEqual(['Free']);
  });

  it('answers the date question on every card it returns', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Free' });

    const dated = await search('?date=2099-06-14');
    expect(dated.items[0]).toHaveProperty('availableOnDate', true);

    // With no date asked, the card makes no claim about one.
    const undated = await search();
    expect(undated.items[0]).not.toHaveProperty('availableOnDate');
  });

  it('leaves a vendor in when only some other date is blocked', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Away later', blockedDates: ['2099-07-01'] });

    expect((await search('?date=2099-06-14')).total).toBe(1);
  });

  it('sorts by rating, then by how many opinions back it', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Mid', rating: 4.2, reviewCount: 10 });
    await seedVendor({ user: 'user_b', businessName: 'Top', rating: 4.9, reviewCount: 10 });

    expect(names((await search('?sort=rating')).items)).toEqual(['Top', 'Mid']);
  });

  it('sorts by price in both directions', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Dear', prices: [500_000] });
    await seedVendor({ user: 'user_b', businessName: 'Cheap', prices: [60_000] });

    expect(names((await search('?sort=price_asc')).items)).toEqual(['Cheap', 'Dear']);
    expect(names((await search('?sort=price_desc')).items)).toEqual(['Dear', 'Cheap']);
  });

  /*
   * An unpriced vendor is not the cheapest, they are unpriced. Leading a
   * cheapest-first list with them would be a lie, so they sort last in both
   * directions rather than being treated as zero.
   */
  it('puts an unpriced vendor last when sorting by price', async () => {
    const unpriced = await seedVendor({ user: 'user_a', businessName: 'Unpriced' });
    await seedVendor({ user: 'user_b', businessName: 'Priced', prices: [60_000] });
    await harness.database.db.delete(servicePackages).where(eq(servicePackages.vendorId, unpriced));

    expect(names((await search('?sort=price_asc')).items)).toEqual(['Priced', 'Unpriced']);
    expect(names((await search('?sort=price_desc')).items)).toEqual(['Priced', 'Unpriced']);
  });

  /*
   * An unreviewed 5.0 is one opinion. Ranking it above a 4.8 with two hundred
   * is noise, so relevance leads with what has been reviewed.
   */
  it('ranks reviewed vendors above unreviewed ones by default', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Unproven', rating: 5, reviewCount: 1 });
    await seedVendor({ user: 'user_b', businessName: 'Proven', rating: 4.8, reviewCount: 200 });

    expect(names((await search()).items)).toEqual(['Proven', 'Unproven']);
  });

  it('rejects a sort key outside the allowlist', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/vendors?sort=price_asc;DROP TABLE vendor_profiles',
    });

    expect(response.statusCode).toBe(400);
  });

  it('paginates with a stable order and a full total', async () => {
    for (const [index, user] of ['user_a', 'user_b', 'user_c'].entries()) {
      await seedVendor({ user, businessName: `Vendor ${index}`, reviewCount: 100 - index });
    }

    const first = await search('?pageSize=2&page=1');
    const second = await search('?pageSize=2&page=2');

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    // No vendor appears on both pages.
    expect(names(first.items).filter((name) => names(second.items).includes(name))).toEqual([]);
  });

  it('answers a page past the end with an empty list, not an error', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Only' });

    const body = await search('?page=50');
    expect(body.items).toEqual([]);
    expect(body.total).toBe(1);
  });

  /*
   * `page` was bounded below and not above, so this reached the DAO and
   * overflowed `int4` in `(page - 1) * pageSize` — a 500 for a URL anyone can
   * paste. Asserted as status **and** body shape, because the point is that it
   * is a refusal the client can read rather than a crash.
   */
  it('refuses a page beyond the ceiling, as a validation error', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/vendors?page=${MAX_PAGE + 1}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: ERROR_CODES.VALIDATION_ERROR,
    });
  });

  it('refuses the int4 boundary that used to reach the query', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendors?page=2147483648' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: ERROR_CODES.VALIDATION_ERROR });
  });

  it('refuses a page size beyond the cap', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/vendors?pageSize=1000' });

    expect(response.statusCode).toBe(400);
  });

  it('combines filters with AND rather than returning their union', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Both', city: 'Austin', rating: 4.9 });
    await seedVendor({ user: 'user_b', businessName: 'City only', city: 'Austin', rating: 3.0 });
    await seedVendor({ user: 'user_c', businessName: 'Rating only', city: 'Dallas', rating: 4.9 });

    expect(names((await search('?city=Austin&minRating=4.5')).items)).toEqual(['Both']);
  });

  /*
   * The counts answer "what would I get if I picked this instead", so the
   * category filter itself is dropped from them — otherwise the selected
   * category would be the only non-zero number on the rail.
   */
  it('counts each category as though it were the one selected', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Photo one' });
    await seedVendor({ user: 'user_b', businessName: 'Photo two' });
    await seedVendor({ user: 'user_c', businessName: 'Caterer', categoryIds: [cateringId] });

    const body = await search('?category=photography');

    // Both are equally rated, so the order between them is not the point here.
    expect(names(body.items).sort()).toEqual(['Photo one', 'Photo two']);
    const facets = new Map(body.facets.categories.map((f) => [f.categoryId, f.count]));
    expect(facets.get(photographyId)).toBe(2);
    expect(facets.get(cateringId)).toBe(1);
  });

  it('narrows the facet counts by the filters that are not category', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Austin photo', city: 'Austin' });
    await seedVendor({ user: 'user_b', businessName: 'Dallas photo', city: 'Dallas' });

    const body = await search('?city=Austin');
    const facets = new Map(body.facets.categories.map((f) => [f.categoryId, f.count]));

    expect(facets.get(photographyId)).toBe(1);
  });

  it('leaves a soft-deleted vendor out of both results and counts', async () => {
    const vendorId = await seedVendor({ user: 'user_a', businessName: 'Gone' });
    await harness.database.db
      .update(vendorProfiles)
      .set({ isDeleted: true })
      .where(eq(vendorProfiles.id, vendorId));

    const body = await search();
    expect(body.total).toBe(0);
    expect(body.facets.categories).toEqual([]);
  });

  it('ignores an inactive package when pricing and filtering', async () => {
    await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.', prices: [80_000, 300_000] });

    const rows = await harness.database.db.select().from(servicePackages);
    const cheapest = rows.find((row) => row.priceCents === 80_000)!;
    await harness.app.inject({
      method: 'PUT',
      url: `/vendor/packages/${cheapest.id}`,
      headers: bearer('user_a'),
      payload: { isActive: false },
    });

    expect((await search()).items[0]?.startingPriceCents).toBe(300_000);
  });

  /*
   * The City field is a select over these (#167), so what this endpoint returns
   * is exactly what a customer is able to ask for. Two things follow, and both
   * are asserted: an unpublished vendor's city must not be offered — choosing
   * it would guarantee an empty grid — and city and state travel as a pair,
   * because "Portland" alone names two places people would fly between.
   */
  describe('GET /vendors/cities', () => {
    async function cities(): Promise<{ city: string; state: string; vendorCount: number }[]> {
      const response = await harness.app.inject({ method: 'GET', url: '/vendors/cities' });
      expect(response.statusCode).toBe(200);

      return response.json();
    }

    it('offers only cities that have a published vendor, counted', async () => {
      await seedVendor({ user: 'user_a', businessName: 'Kessler & Co.', city: 'Austin' });
      await seedVendor({ user: 'user_b', businessName: 'June Harlow', city: 'Austin' });
      await seedVendor({
        user: 'user_c',
        businessName: 'Draft Studio',
        city: 'Dallas',
        publish: false,
      });

      expect(await cities()).toEqual([{ city: 'Austin', state: 'TX', vendorCount: 2 }]);
    });

    it('keeps two cities of the same name apart by their state', async () => {
      await seedVendor({
        user: 'user_a',
        businessName: 'Rose City Film',
        city: 'Portland',
        state: 'OR',
      });
      await seedVendor({
        user: 'user_b',
        businessName: 'Casco Bay Photo',
        city: 'Portland',
        state: 'ME',
      });

      // Two rows, not one — and ordered, so the list cannot shuffle per read.
      expect(await cities()).toEqual([
        { city: 'Portland', state: 'ME', vendorCount: 1 },
        { city: 'Portland', state: 'OR', vendorCount: 1 },
      ]);
    });

    it('answers with an empty list rather than failing when nobody has published', async () => {
      expect(await cities()).toEqual([]);
    });
  });
});
