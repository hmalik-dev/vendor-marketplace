import { users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { categories } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_vendor';
const OTHER_VENDOR = 'user_vendor_two';
const CUSTOMER = 'user_customer';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('/vendor/packages', () => {
  let harness: TestHarness;
  let photographyId: string;

  function packageBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'Half-day coverage',
      description: 'Four hours of documentary coverage and 100 edited photos.',
      priceCents: 120_000,
      ...overrides,
    };
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

  async function createPackage(
    clerkUserId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; displayOrder: number }> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(clerkUserId),
      payload: packageBody(overrides),
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
      const response = await harness.app.inject({ method: 'GET', url: '/vendor/packages' });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('UNAUTHORIZED');
    });

    it('rejects a customer', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/packages',
        headers: bearer(CUSTOMER),
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('FORBIDDEN');
    });

    it('answers 404 for a vendor who has not created a profile yet', async () => {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });
  });

  describe('POST', () => {
    it('creates a package and answers 201 with its location', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
        payload: packageBody({
          durationHours: 4.5,
          maxGuests: 120,
          inclusions: ['4 hours coverage', '100 edited photos'],
        }),
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(response.headers.location).toBe(`/vendor/packages/${body.id}`);
      expect(body.name).toBe('Half-day coverage');
      expect(body.priceCents).toBe(120_000);
      expect(body.priceType).toBe('fixed');
      expect(body.durationHours).toBe(4.5);
      expect(body.maxGuests).toBe(120);
      expect(body.inclusions).toEqual(['4 hours coverage', '100 edited photos']);
      expect(body.isActive).toBe(true);
      expect(body.displayOrder).toBe(0);
    });

    it('rejects a price below the $25 floor', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
        payload: packageBody({ priceCents: 0 }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('rejects a price above the $100,000 ceiling', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'POST',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
        payload: packageBody({ priceCents: 10_000_001 }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
    });

    it('places each new package after the last one', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const first = await createPackage(VENDOR, { name: 'First' });
      const second = await createPackage(VENDOR, { name: 'Second' });

      expect(first.displayOrder).toBe(0);
      expect(second.displayOrder).toBe(1);
    });
  });

  describe('GET', () => {
    it('returns the vendor’s own packages in display order', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      await createPackage(VENDOR, { name: 'Mine' });
      await createPackage(OTHER_VENDOR, { name: 'Theirs' });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: { name: string }) => row.name)).toEqual(['Mine']);
    });

    it('includes deactivated packages so the vendor can bring one back', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const created = await createPackage(VENDOR);

      await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${created.id}`,
        headers: bearer(VENDOR),
        payload: { isActive: false },
      });

      const response = await harness.app.inject({
        method: 'GET',
        url: '/vendor/packages',
        headers: bearer(VENDOR),
      });

      expect(response.json()).toHaveLength(1);
      expect(response.json()[0].isActive).toBe(false);
    });
  });

  describe('PUT /:packageId', () => {
    it('applies only the submitted fields', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const created = await createPackage(VENDOR, { inclusions: ['4 hours coverage'] });

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${created.id}`,
        headers: bearer(VENDOR),
        payload: { priceCents: 150_000 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().priceCents).toBe(150_000);
      expect(response.json().name).toBe('Half-day coverage');
      expect(response.json().inclusions).toEqual(['4 hours coverage']);
    });

    it('answers 404 for a package owned by another vendor', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      const theirs = await createPackage(OTHER_VENDOR);

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${theirs.id}`,
        headers: bearer(VENDOR),
        payload: { priceCents: 150_000 },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NOT_FOUND');
    });

    it('answers 404 for a package that does not exist', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');

      const response = await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${UNKNOWN_ID}`,
        headers: bearer(VENDOR),
        payload: { priceCents: 150_000 },
      });

      expect(response.statusCode).toBe(404);
    });

    it('takes a published profile off the marketplace with its last active package', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const created = await createPackage(VENDOR);

      const published = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });
      expect(published.json().isPublished).toBe(true);

      await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${created.id}`,
        headers: bearer(VENDOR),
        payload: { isActive: false },
      });

      const profile = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(profile.json().isPublished).toBe(false);
      expect(profile.json().publishBlockers).toContain('Publish at least one service package');
    });

    it('leaves a published profile alone while another package stays active', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await createPackage(VENDOR, { name: 'First' });
      await createPackage(VENDOR, { name: 'Second' });

      await harness.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      });

      await harness.app.inject({
        method: 'PUT',
        url: `/vendor/packages/${first.id}`,
        headers: bearer(VENDOR),
        payload: { isActive: false },
      });

      const profile = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(profile.json().isPublished).toBe(true);
    });
  });

  describe('PUT /reorder', () => {
    it('rewrites every position from the submitted order', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await createPackage(VENDOR, { name: 'First' });
      const second = await createPackage(VENDOR, { name: 'Second' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/packages/reorder',
        headers: bearer(VENDOR),
        payload: { packageIds: [second.id, first.id] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().map((row: { name: string }) => row.name)).toEqual(['Second', 'First']);
      expect(response.json().map((row: { displayOrder: number }) => row.displayOrder)).toEqual([
        0, 1,
      ]);
    });

    it('rejects an order that leaves a package out', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await createPackage(VENDOR, { name: 'First' });
      await createPackage(VENDOR, { name: 'Second' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/packages/reorder',
        headers: bearer(VENDOR),
        payload: { packageIds: [first.id] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Send every one of your packages in the new order.');
    });

    it('rejects an order naming the same package twice', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      const first = await createPackage(VENDOR, { name: 'First' });
      await createPackage(VENDOR, { name: 'Second' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/packages/reorder',
        headers: bearer(VENDOR),
        payload: { packageIds: [first.id, first.id] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Each package may appear only once in the order.');
    });

    it('rejects an order naming another vendor’s package', async () => {
      await createProfile(VENDOR, 'Sunlit Studio');
      await createProfile(OTHER_VENDOR, 'Moonlit Studio');
      await createPackage(VENDOR, { name: 'Mine' });
      const theirs = await createPackage(OTHER_VENDOR, { name: 'Theirs' });

      const response = await harness.app.inject({
        method: 'PUT',
        url: '/vendor/packages/reorder',
        headers: bearer(VENDOR),
        payload: { packageIds: [theirs.id] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('That order names a package you do not own.');
    });
  });
});
