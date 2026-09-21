import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { eq, ne } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

const VENDOR = 'user_stale_vendor';

/**
 * VEN-481: a save carries the `updatedAt` its form was opened on, and a row that
 * has moved since refuses it with the current values rather than losing the
 * earlier edit without a word.
 */
describe('stale edits to a vendor profile and its packages', () => {
  let harness: TestHarness;
  let photographyId: string;
  let cateringId: string;

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set(VENDOR, {
      authUserId: VENDOR,
      email: 'stale@example.com',
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'vendor',
      avatarUrl: null,
    });

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;

    const other = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(ne(categories.slug, 'photography'))
      .limit(1);
    cateringId = other[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function createProfile(): Promise<{ updatedAt: string }> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography.',
        responseTimeHours: 24,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function putProfile(payload: Record<string, unknown>) {
    return harness.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload,
    });
  }

  async function createPackage(): Promise<{ id: string; updatedAt: string }> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Half-day coverage',
        description: 'Four hours of documentary coverage and 100 edited photos.',
        priceCents: 120_000,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function putPackage(id: string, payload: Record<string, unknown>) {
    return harness.app.inject({
      method: 'PUT',
      url: `/vendor/packages/${id}`,
      headers: bearer(VENDOR),
      payload,
    });
  }

  describe('package', () => {
    it('refuses the second of two saves from one version and carries the current row', async () => {
      await createProfile();
      const created = await createPackage();

      const first = await putPackage(created.id, {
        priceCents: 150_000,
        updatedAt: created.updatedAt,
      });
      const second = await putPackage(created.id, {
        name: 'Other name',
        updatedAt: created.updatedAt,
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe('CONFLICT');
      expect(second.json().details.current).toMatchObject({
        id: created.id,
        name: 'Half-day coverage',
        priceCents: 150_000,
        updatedAt: first.json().updatedAt,
      });
    });

    it('applies a save from the current version', async () => {
      await createProfile();
      const created = await createPackage();

      const first = await putPackage(created.id, {
        priceCents: 150_000,
        updatedAt: created.updatedAt,
      });
      const second = await putPackage(created.id, {
        priceCents: 175_000,
        updatedAt: first.json().updatedAt,
      });

      expect(second.statusCode).toBe(200);
      expect(second.json().priceCents).toBe(175_000);
    });

    it('does not turn an unversioned save away', async () => {
      await createProfile();
      const created = await createPackage();

      const response = await putPackage(created.id, { priceCents: 150_000 });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('vendor profile', () => {
    it('refuses the second of two saves from one version and carries the current profile', async () => {
      const created = await createProfile();

      const first = await putProfile({ tagline: 'First tab', updatedAt: created.updatedAt });
      const second = await putProfile({ bio: 'Second tab bio.', updatedAt: created.updatedAt });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe('CONFLICT');
      expect(second.json().details.current).toMatchObject({
        tagline: 'First tab',
        bio: 'Documentary wedding photography.',
        updatedAt: first.json().updatedAt,
      });
    });

    it('refuses a stale save that only changes the categories, and leaves them alone', async () => {
      const created = await createProfile();
      await putProfile({ tagline: 'First tab', updatedAt: created.updatedAt });

      const stale = await putProfile({ categoryIds: [cateringId], updatedAt: created.updatedAt });
      const current = await harness.app.inject({
        method: 'GET',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
      });

      expect(stale.statusCode).toBe(409);
      expect(current.json().categoryIds).toEqual([photographyId]);
    });

    it('refuses the second of two category-only saves from one version', async () => {
      const created = await createProfile();

      const first = await putProfile({ categoryIds: [cateringId], updatedAt: created.updatedAt });
      const second = await putProfile({
        categoryIds: [photographyId],
        updatedAt: created.updatedAt,
      });

      expect(first.statusCode).toBe(200);
      expect(first.json().updatedAt).not.toBe(created.updatedAt);
      expect(second.statusCode).toBe(409);
    });

    it('answers 400 for a null version rather than a refusal that can never clear', async () => {
      await createProfile();

      const response = await putProfile({ tagline: 'x', updatedAt: null });

      expect(response.statusCode).toBe(400);
    });

    it('applies a save from the current version', async () => {
      const created = await createProfile();

      const first = await putProfile({ tagline: 'First tab', updatedAt: created.updatedAt });
      const second = await putProfile({
        tagline: 'Second save',
        updatedAt: first.json().updatedAt,
      });

      expect(second.statusCode).toBe(200);
      expect(second.json().tagline).toBe('Second save');
    });

    it('does not turn an unversioned save away', async () => {
      await createProfile();

      const response = await putProfile({ tagline: 'No version' });

      expect(response.statusCode).toBe(200);
    });
  });
});
