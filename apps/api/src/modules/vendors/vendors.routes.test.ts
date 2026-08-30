import { eq } from 'drizzle-orm';
import { categories, users, vendorCategories, vendorProfiles } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';

describe('/vendor/profile', () => {
  let harness: TestHarness;
  let photographyId: string;
  let cateringId: string;

  async function categoryIdBySlug(slug: string): Promise<string> {
    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const row = rows[0];
    expect(row).toBeDefined();
    return row!.id;
  }

  /** The minimum body the create endpoint accepts. */
  function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      businessName: 'Sunlit Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      ...overrides,
    };
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

    photographyId = await categoryIdBySlug('photography');
    cateringId = await categoryIdBySlug('catering');
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('POST', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        payload: validBody(),
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(CUSTOMER),
        payload: validBody(),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('FORBIDDEN');
    });

    it('creates the profile and answers 201 with its location', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ bio: 'Documentary wedding photography.' }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers.location).toBe('/vendor/profile');

      const body = response.json();
      expect(body.businessName).toBe('Sunlit Studio');
      expect(body.slug).toBe('sunlit-studio');
      expect(body.isPublished).toBe(false);
      expect(body.categoryIds).toEqual([photographyId]);
      expect(body.tags).toEqual([]);
      // The bio was supplied; a reply window and a bookable package are what
      // is still missing.
      expect(body.publishBlockers).toEqual(['responseTime', 'packages']);
    });

    it('persists the category selection', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ categoryIds: [photographyId, cateringId] }),
      });

      const rows = await harness.database.db.select().from(vendorCategories);
      expect(rows).toHaveLength(2);
    });

    it('requires at least one category', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ categoryIds: [] }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('rejects a category that does not exist', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ categoryIds: ['11111111-1111-4111-8111-111111111111'] }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toMatch(/categories are unavailable/i);
    });

    /*
     * #222: the editor could not render the refusal on the control that caused
     * it, so a vendor saw a dead button. The message alone is not enough — the
     * form needs to know which of its controls to mark, and it cannot get that
     * by matching on prose.
     */
    it('names the offending field, so the editor can mark the right control', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ categoryIds: ['11111111-1111-4111-8111-111111111111'] }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details).toEqual({ field: 'categoryIds' });
    });

    it('says how to fix an unavailable category, not only that it failed', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ categoryIds: ['11111111-1111-4111-8111-111111111111'] }),
      });

      expect(response.json().message).toBe(
        'One or more selected categories are unavailable. Reload the page and choose from the current list.',
      );
    });

    it('requires a city and a state', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { businessName: 'Sunlit Studio', categoryIds: [photographyId] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('disambiguates a slug that is already taken', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(),
      });

      const second = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(OTHER_VENDOR),
        payload: validBody(),
      });

      expect(second.statusCode).toBe(201);
      expect(second.json().slug).toBe('sunlit-studio-2');
    });

    it('falls back to a usable slug for a name with no ASCII equivalent', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ businessName: '写真スタジオ' }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().slug).toBe('vendor');
    });

    it('refuses a second profile for the same vendor', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(),
      });

      const second = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ businessName: 'Another Studio' }),
      });

      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe('CONFLICT');
    });
  });

  describe('GET', () => {
    it('answers 404 before a profile exists', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('returns the profile with its selections once created', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ bio: 'Documentary wedding photography.' }),
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        businessName: 'Sunlit Studio',
        city: 'Austin',
        categoryIds: [photographyId],
      });
    });

    it('does not leak another vendor’s profile', async () => {
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(),
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(OTHER_VENDOR),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT', () => {
    async function createProfile(overrides: Record<string, unknown> = {}): Promise<void> {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(overrides),
      });
      expect(response.statusCode).toBe(201);
    }

    /** Publishing needs something bookable, so most publish tests need one. */
    async function addPackage(): Promise<void> {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
        payload: {
          name: 'Half-day coverage',
          description: 'Four hours of documentary coverage and edited photos.',
          priceCents: 120_000,
        },
      });
      expect(response.statusCode).toBe(201);
    }

    it('answers 404 when there is nothing to edit', async () => {
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { bio: 'Hello' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('updates only the fields present in the request', async () => {
      await createProfile({ bio: 'Original bio.' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { city: 'Dallas' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ city: 'Dallas', bio: 'Original bio.' });
    });

    it('replaces the category selection wholesale', async () => {
      await createProfile({ categoryIds: [photographyId, cateringId] });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { categoryIds: [cateringId] },
      });

      expect(response.json().categoryIds).toEqual([cateringId]);
      expect(await harness.database.db.select().from(vendorCategories)).toHaveLength(1);
    });

    it('tracks the slug to the business name while unpublished', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { businessName: 'Moonlit Studio' },
      });

      expect(response.json().slug).toBe('moonlit-studio');
    });

    it('refuses to publish while prerequisites are outstanding', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details.blockers).toContain('bio');
    });

    it('publishes once every prerequisite is met', async () => {
      await createProfile({ bio: 'Documentary wedding photography.', responseTimeHours: 24 });
      await addPackage();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().isPublished).toBe(true);
    });

    /*
     * A customer deciding between two vendors reads the reply window before
     * they read the bio, so an unanswered one holds the profile back the same
     * way a missing category does.
     */
    it('holds publication back until a reply window is set', async () => {
      await createProfile({ bio: 'Documentary wedding photography.' });
      await addPackage();

      const blocked = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      expect(blocked.statusCode).toBe(400);
      expect(blocked.json().details.blockers).toEqual(['responseTime']);

      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { responseTimeHours: 24 },
      });

      const published = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      expect(published.statusCode).toBe(200);
      expect(published.json().isPublished).toBe(true);
      expect(published.json().publishBlockers).toEqual([]);
    });

    it('unpublishes without any prerequisite check', async () => {
      await createProfile({ bio: 'Documentary wedding photography.', responseTimeHours: 24 });
      await addPackage();
      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().isPublished).toBe(false);
    });

    it('lists every outstanding prerequisite on the profile it returns', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(response.json().publishBlockers).toEqual(['bio', 'responseTime', 'packages']);
    });

    it('rejects an attempt to write a derived rating', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { avgRating: 5, reviewCount: 99 },
      });

      // `avgRating` is absent from the update schema, so nothing is left to
      // apply and the request fails its "at least one field" refinement.
      expect(response.statusCode).toBe(400);
      const rows = await harness.database.db.select().from(vendorProfiles);
      expect(rows[0]?.avgRating).toBe('0.00');
    });

    it('clears a bio submitted empty, and reinstates the publish prerequisite', async () => {
      await createProfile({ bio: 'Documentary wedding photography.' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { bio: '   ' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().bio).toBeNull();
      expect(response.json().publishBlockers).toContain('bio');

      const rows = await harness.database.db.select().from(vendorProfiles);
      expect(rows[0]?.bio).toBeNull();
    });

    it('stores an address submitted empty as null rather than an empty string', async () => {
      await createProfile({ address: '123 Congress Ave' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { address: '' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().address).toBeNull();
    });

    it('refuses to publish once the bio has been cleared', async () => {
      await createProfile({ bio: 'Documentary wedding photography.' });
      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { bio: '' },
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects a response window outside the offered set', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { responseTimeHours: 7 },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
