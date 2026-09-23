import { and, eq } from 'drizzle-orm';
import { MAX_TAGS_PER_CATEGORY, type TagCategory } from '@vendor-marketplace/shared';
import {
  categories,
  tags,
  users,
  vendorCategories,
  vendorProfiles,
  vendorTags,
} from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  type TestHarness,
  acceptVendorAgreementAs,
} from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';
const VENDOR_NO_NAME = 'user_vendor_no_name';

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

    for (const [authUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [OTHER_VENDOR, 'vendor', 'ada@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    /*
     * Blank, like a fresh sign-up whose only name is the sign-up form's
     * synthetic email-prefix placeholder split with no space in it (VEN-642) —
     * for the `personalName` publish blocker, which every other fixture above
     * satisfies by construction and so could never exercise.
     */
    harness.authUsers.set(VENDOR_NO_NAME, {
      authUserId: VENDOR_NO_NAME,
      email: 'nameless@example.com',
      firstName: '',
      lastName: '',
      roleHint: 'vendor',
      avatarUrl: null,
    });

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
      expect(body.publishBlockers).toEqual(['responseTime', 'packages', 'agreement']);
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

    it('never gives a storefront the slug the vendor application route answers (VEN-406)', async () => {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ businessName: 'Apply' }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().slug).toBe('apply-2');
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

    /*
     * Both requests pass the "no profile yet" read before either inserts, so the
     * loser is stopped by the unique index and not by the service's own check.
     */
    it('answers 409, not 500, to two concurrent creates for the same vendor', async () => {
      const responses = await Promise.all(
        ['First Studio', 'Second Studio'].map((businessName) =>
          harness.app.inject({
            method: 'POST',
            url: '/vendor/profile',
            headers: bearer(VENDOR),
            payload: validBody({ businessName }),
          }),
        ),
      );

      expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
      const loser = responses.find((response) => response.statusCode === 409);
      expect(loser?.json().error).toBe('CONFLICT');
      expect(loser?.json().message).toBe('You already have a vendor profile');
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
      await acceptVendorAgreementAs(harness, VENDOR);

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
      expect(blocked.json().details.blockers).toEqual(['responseTime', 'agreement']);

      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { responseTimeHours: 24 },
      });

      await acceptVendorAgreementAs(harness, VENDOR);
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

    /*
     * `users.firstName`/`lastName`, not a `vendor_profiles` column (VEN-642) —
     * the same personal-name gap the customer interstitial closes, applied to
     * vendors so neither role can publish forever under a blank name.
     */
    describe('the personal name blocker (VEN-642)', () => {
      async function createNamelessProfile(): Promise<void> {
        const response = await harness.app.inject({
          method: 'POST',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
          payload: validBody(),
        });
        expect(response.statusCode).toBe(201);
      }

      it('lists personalName among the prerequisites for a nameless vendor', async () => {
        await createNamelessProfile();

        const response = await harness.app.inject({
          method: 'GET',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
        });

        expect(response.json().publishBlockers).toContain('personalName');
      });

      it('refuses to publish while the vendor has no name on file', async () => {
        await createNamelessProfile();
        await harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
          payload: { bio: 'Documentary wedding photography.', responseTimeHours: 24 },
        });
        await harness.app.inject({
          method: 'POST',
          url: '/vendor/packages',
          headers: bearer(VENDOR_NO_NAME),
          payload: {
            name: 'Half-day coverage',
            description: 'Four hours of documentary coverage and edited photos.',
            priceCents: 120_000,
          },
        });
        await acceptVendorAgreementAs(harness, VENDOR_NO_NAME);

        const response = await harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
          payload: { isPublished: true },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().details.blockers).toEqual(['personalName']);
      });

      it('writes a name sent alongside the publish, onto `users` not this row, and clears the blocker', async () => {
        await createNamelessProfile();
        await harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
          payload: { bio: 'Documentary wedding photography.', responseTimeHours: 24 },
        });
        await harness.app.inject({
          method: 'POST',
          url: '/vendor/packages',
          headers: bearer(VENDOR_NO_NAME),
          payload: {
            name: 'Half-day coverage',
            description: 'Four hours of documentary coverage and edited photos.',
            priceCents: 120_000,
          },
        });
        await acceptVendorAgreementAs(harness, VENDOR_NO_NAME);

        const response = await harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR_NO_NAME),
          payload: { firstName: 'Priya', lastName: 'Nair', isPublished: true },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().isPublished).toBe(true);
        expect(response.json().publishBlockers).toEqual([]);
        expect(response.json()).not.toMatchObject({ firstName: expect.anything() });

        const [row] = await harness.database.db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.email, 'nameless@example.com'));
        expect(row).toMatchObject({ firstName: 'Priya', lastName: 'Nair' });
      });
    });

    describe('editing a live storefront (VEN-557)', () => {
      async function goLive(): Promise<void> {
        await createProfile({ bio: 'Documentary wedding photography.', responseTimeHours: 24 });
        await addPackage();
        await acceptVendorAgreementAs(harness, VENDOR);
        const live = await harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR),
          payload: { isPublished: true },
        });
        expect(live.json().isPublished).toBe(true);
      }

      async function put(payload: Record<string, unknown>) {
        return harness.app.inject({
          method: 'PUT',
          url: '/vendor/profile',
          headers: bearer(VENDOR),
          payload,
        });
      }

      it('refuses to blank the bio and leaves the row unchanged', async () => {
        await goLive();

        const response = await put({ bio: '' });

        expect(response.statusCode).toBe(400);
        expect(response.json().details.blockers).toEqual(['bio']);

        const [row] = await harness.database.db.select().from(vendorProfiles);
        expect(row?.bio).toBe('Documentary wedding photography.');
        expect(row?.isPublished).toBe(true);
      });

      it('refuses to clear the reply window', async () => {
        await goLive();

        const response = await put({ responseTimeHours: null });

        expect(response.statusCode).toBe(400);
        expect(response.json().details.blockers).toEqual(['responseTime']);

        const [row] = await harness.database.db.select().from(vendorProfiles);
        expect(row?.responseTimeHours).toBe(24);
        expect(row?.isPublished).toBe(true);
      });

      it('saves a complete edit', async () => {
        await goLive();

        const response = await put({ bio: 'Film and photo.', responseTimeHours: 48 });

        expect(response.statusCode).toBe(200);
        expect(response.json().bio).toBe('Film and photo.');
        expect(response.json().isPublished).toBe(true);
      });

      it('lets a draft save those values', async () => {
        await createProfile({ bio: 'Documentary wedding photography.', responseTimeHours: 24 });

        const response = await put({ bio: '', responseTimeHours: null });

        expect(response.statusCode).toBe(200);
        expect(response.json().bio).toBeNull();
        expect(response.json().responseTimeHours).toBeNull();
      });

      it('lets a live vendor unpublish while blanking a field', async () => {
        await goLive();

        const response = await put({ bio: '', isPublished: false });

        expect(response.statusCode).toBe(200);
        expect(response.json().isPublished).toBe(false);
        expect(response.json().bio).toBeNull();
      });

      it('names every blocker one edit introduces, and only those', async () => {
        await goLive();

        const response = await put({ bio: '', responseTimeHours: null, tagline: 'Still here' });

        expect(response.statusCode).toBe(400);
        expect(response.json().details.blockers).toEqual(['bio', 'responseTime']);
      });
    });

    it('unpublishes without any prerequisite check', async () => {
      await createProfile({ bio: 'Documentary wedding photography.', responseTimeHours: 24 });
      await addPackage();
      await acceptVendorAgreementAs(harness, VENDOR);
      const live = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });
      expect(live.json().isPublished).toBe(true);

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

      expect(response.json().publishBlockers).toEqual([
        'bio',
        'responseTime',
        'packages',
        'agreement',
      ]);
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

    it('clears years in business and the response window when sent as null', async () => {
      await createProfile({ yearsInBusiness: 7, responseTimeHours: 24 });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { yearsInBusiness: null, responseTimeHours: null },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().yearsInBusiness).toBeNull();
      expect(response.json().responseTimeHours).toBeNull();

      const rows = await harness.database.db.select().from(vendorProfiles);
      expect(rows[0]?.yearsInBusiness).toBeNull();
      expect(rows[0]?.responseTimeHours).toBeNull();
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

  /*
   * #405. The storefront editor used to save the profile and the tags as two
   * requests with nothing tying them together, so a refused tag list left the
   * profile write standing: the vendor could never get a clean save, the bar
   * said `Unsaved changes` forever, and on first-time creation the retry 409'd
   * on the profile the failed attempt had already made. Tags now travel in the
   * profile body and every write lands or none does.
   */
  describe('tags saved with the profile', () => {
    async function createProfile(overrides: Record<string, unknown> = {}): Promise<void> {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(overrides),
      });
      expect(response.statusCode).toBe(201);
    }

    // `hiddenTagId` deactivates a shared reference row, and the suite's own
    // `afterEach` only clears profiles and users.
    afterEach(async () => {
      await harness.database.db.update(tags).set({ isActive: true });
    });

    async function activeTagIds(category: TagCategory, count: number): Promise<string[]> {
      const rows = await harness.database.db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.category, category), eq(tags.isActive, true)))
        .limit(count);

      expect(rows).toHaveLength(count);
      return rows.map((row) => row.id);
    }

    /** A tag an admin has taken out of circulation — the deterministic case. */
    async function hiddenTagId(): Promise<string> {
      const [id] = await activeTagIds('language', 1);
      await harness.database.db.update(tags).set({ isActive: false }).where(eq(tags.id, id!));

      return id!;
    }

    it('stores tags sent with the create, and returns them', async () => {
      const tagIds = await activeTagIds('language', 2);

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ tagIds }),
      });

      expect(response.statusCode).toBe(201);
      expect(
        response
          .json()
          .tags.map((tag: { id: string }) => tag.id)
          .sort(),
      ).toEqual([...tagIds].sort());
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(2);
    });

    it('creates no profile at all when the tag list is refused', async () => {
      const hidden = await hiddenTagId();

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ tagIds: [hidden] }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details?.field).toBe('tagIds');
      // The row the old two-request save left behind is what made the vendor's
      // next attempt answer 409 instead of succeeding.
      expect(await harness.database.db.select().from(vendorProfiles)).toHaveLength(0);

      const retry = await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody(),
      });
      expect(retry.statusCode).toBe(201);
    });

    it('stores tags sent with an update', async () => {
      await createProfile();
      const tagIds = await activeTagIds('dietary', 1);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { businessName: 'Sunlit Studio Co', tagIds },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tags.map((tag: { id: string }) => tag.id)).toEqual(tagIds);
    });

    it('keeps no part of an update whose tag list is refused', async () => {
      await createProfile();
      const hidden = await hiddenTagId();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { businessName: 'Renamed Studio', tagIds: [hidden] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details?.field).toBe('tagIds');

      const rows = await harness.database.db.select().from(vendorProfiles);
      expect(rows[0]?.businessName).toBe('Sunlit Studio');
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(0);
    });

    it('leaves the existing selection alone when the body carries no tagIds', async () => {
      const tagIds = await activeTagIds('language', 1);
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ tagIds }),
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { businessName: 'Sunlit Studio Co' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tags.map((tag: { id: string }) => tag.id)).toEqual(tagIds);
    });

    it('collapses a duplicate id rather than failing the insert', async () => {
      await createProfile();
      const [only] = await activeTagIds('language', 1);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds: [only, only] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tags).toHaveLength(1);
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(1);
    });

    it('rejects a tag id that does not exist, and names the control', async () => {
      await createProfile();

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds: ['00000000-0000-4000-8000-0000000000ff'] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details).toEqual({ field: 'tagIds' });
    });

    it(`rejects more than ${MAX_TAGS_PER_CATEGORY} tags in one category`, async () => {
      await createProfile();
      const tagIds = await activeTagIds('language', MAX_TAGS_PER_CATEGORY + 1);

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details).toEqual({ field: 'tagIds' });
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(0);
    });

    it('allows the per-category maximum in each category at once', async () => {
      await createProfile();
      const tagIds = [
        ...(await activeTagIds('language', MAX_TAGS_PER_CATEGORY)),
        ...(await activeTagIds('cultural', MAX_TAGS_PER_CATEGORY)),
      ];

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tags).toHaveLength(MAX_TAGS_PER_CATEGORY * 2);
    });

    it('replaces the previous selection rather than adding to it', async () => {
      await createProfile();
      const [first, second] = await activeTagIds('language', 2);

      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds: [first] },
      });
      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds: [second] },
      });

      expect(response.json().tags.map((tag: { id: string }) => tag.id)).toEqual([second]);
      const stored = await harness.database.db.select().from(vendorTags);
      expect(stored.map((row) => row.tagId)).toEqual([second]);
    });

    it('clears the selection when the body carries an empty tagIds', async () => {
      const tagIds = await activeTagIds('language', 1);
      await harness.app.inject({
        method: 'POST',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: validBody({ tagIds }),
      });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { tagIds: [] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().tags).toEqual([]);
      expect(await harness.database.db.select().from(vendorTags)).toHaveLength(0);
    });
  });
});
