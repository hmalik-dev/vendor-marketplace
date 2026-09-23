import { adminActions, categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { CATEGORY_SEEDS } from '@vendor-marketplace/shared';
import { asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
  acceptVendorAgreementAs,
} from '../../testing/test-server.js';
import { setCategoryActiveRow } from './admin-categories.dao.js';

const ADMIN = 'user_admin';
const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

/**
 * VEN-401 — an operator withdraws and reorders categories, and the public
 * reads follow: `/categories` (the landing pills and the search rail's list)
 * and the `/vendors` facet counts.
 */
describe('admin category management', () => {
  let harness: TestHarness;
  let adminId: string;
  let photographyId: string;
  let cateringId: string;

  const categoryRows = () =>
    harness.database.db
      .select({ id: categories.id, slug: categories.slug, displayOrder: categories.displayOrder })
      .from(categories)
      .orderBy(asc(categories.displayOrder), asc(categories.name));

  /** `admin_actions` is append-only, so a test reads only the rows written since it began. */
  let priorActionIds = new Set<string>();

  async function newActions() {
    const rows = await harness.database.db
      .select({
        id: adminActions.id,
        actorId: adminActions.actorId,
        action: adminActions.action,
        subjectType: adminActions.subjectType,
        subjectId: adminActions.subjectId,
        detail: adminActions.detail,
      })
      .from(adminActions)
      .orderBy(asc(adminActions.createdAt));

    return rows.filter((row) => !priorActionIds.has(row.id)).map(({ id: _id, ...row }) => row);
  }

  const actionsOn = async (subjectId: string) =>
    (await newActions())
      .filter((row) => row.subjectId === subjectId)
      .map(({ subjectId: _subjectId, ...row }) => row);

  const setActive = (categoryId: string, isActive: boolean, authUserId = ADMIN) =>
    harness.app.inject({
      method: 'PUT',
      url: `/v1/admin/categories/${categoryId}`,
      headers: bearer(authUserId),
      payload: { isActive },
    });

  /** `basedOn` defaults to the order as it stands, which is what a fresh screen sends. */
  const reorder = async (categoryIds: string[], basedOn?: string[]) =>
    harness.app.inject({
      method: 'PUT',
      url: '/v1/admin/categories/order',
      headers: bearer(ADMIN),
      payload: {
        categoryIds,
        basedOnCategoryIds: basedOn ?? (await categoryRows()).map((row) => row.id),
      },
    });

  /** A published vendor listed under photography and catering, so both have a facet. */
  async function publishVendorInBoth(): Promise<void> {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Two Trades',
        categoryIds: [photographyId, cateringId],
        city: 'Austin',
        state: 'TX',
        bio: 'Two Trades does good work.',
        responseTimeHours: 24,
      },
    });
    expect(created.statusCode).toBe(201);

    const pkg = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Package',
        description: 'A package with a description long enough to pass validation.',
        priceCents: 150_000,
      },
    });
    expect(pkg.statusCode).toBe(201);

    await acceptVendorAgreementAs(harness, VENDOR);
    const published = await harness.app.inject({
      method: 'PUT',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    for (const [authUserId, roleHint] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint,
        avatarUrl: null,
      });
    }
    adminId = await signInAs(harness, ADMIN, true);
    await signInAs(harness, CUSTOMER);

    const rows = await categoryRows();
    photographyId = rows.find((row) => row.slug === 'photography')!.id;
    cateringId = rows.find((row) => row.slug === 'catering')!.id;
  });

  beforeEach(async () => {
    const rows = await harness.database.db.select({ id: adminActions.id }).from(adminActions);
    priorActionIds = new Set(rows.map((row) => row.id));
  });

  afterEach(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users).where(eq(users.authUserId, VENDOR));
    for (const seed of CATEGORY_SEEDS) {
      await harness.database.db
        .update(categories)
        .set({ isActive: true, displayOrder: seed.displayOrder })
        .where(eq(categories.slug, seed.slug));
    }
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('authorization', () => {
    it.each([
      ['GET', '/v1/admin/categories', undefined],
      ['PUT', '/v1/admin/categories/order', { categoryIds: ['not-a-uuid'] }],
      ['PUT', '/v1/admin/categories/not-a-uuid', { isActive: 'nope' }],
    ] as const)(
      'refuses %s %s to a customer with 403 before validating',
      async (method, url, payload) => {
        const response = await harness.app.inject({
          method,
          url,
          headers: bearer(CUSTOMER),
          ...(payload ? { payload } : {}),
        });

        expect(response.statusCode).toBe(403);
      },
    );

    it('refuses an anonymous caller with 401', async () => {
      const response = await harness.app.inject({ method: 'GET', url: '/v1/admin/categories' });

      expect(response.statusCode).toBe(401);
    });
  });

  it('lists every category with its vendor count, inactive ones included', async () => {
    await publishVendorInBoth();
    expect((await setActive(cateringId, false)).statusCode).toBe(200);

    const response = await harness.app.inject({
      method: 'GET',
      url: '/v1/admin/categories',
      headers: bearer(ADMIN),
    });

    expect(response.statusCode).toBe(200);
    const items = response.json().items as Array<{
      id: string;
      slug: string;
      isActive: boolean;
      vendorCount: number;
    }>;
    expect(items.map((item) => item.slug)).toEqual(CATEGORY_SEEDS.map((seed) => seed.slug));
    expect(items.find((item) => item.id === cateringId)).toMatchObject({
      isActive: false,
      vendorCount: 1,
    });
    expect(items.find((item) => item.slug === 'decor')).toMatchObject({
      isActive: true,
      vendorCount: 0,
    });
  });

  describe('deactivate and reactivate', () => {
    it('writes one admin_actions row per change and answers with the row', async () => {
      await publishVendorInBoth();

      const off = await setActive(cateringId, false);
      expect(off.statusCode).toBe(200);
      expect(off.json()).toMatchObject({ id: cateringId, isActive: false, vendorCount: 1 });

      const on = await setActive(cateringId, true);
      expect(on.statusCode).toBe(200);
      expect(on.json()).toMatchObject({ id: cateringId, isActive: true });

      expect(await actionsOn(cateringId)).toEqual([
        {
          actorId: adminId,
          action: 'category_deactivated',
          subjectType: 'category',
          detail: { isActive: false, vendorCount: 1 },
        },
        {
          actorId: adminId,
          action: 'category_reactivated',
          subjectType: 'category',
          detail: { isActive: true, vendorCount: 1 },
        },
      ]);
    });

    it('logs nothing when the category is already in that state', async () => {
      const response = await setActive(cateringId, true);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: cateringId, isActive: true });
      expect(await actionsOn(cateringId)).toEqual([]);
    });

    it('answers 404 for a category that does not exist', async () => {
      const response = await setActive('00000000-0000-4000-8000-000000000000', false);

      expect(response.statusCode).toBe(404);
    });

    /*
     * The race's losing half: a toggle that read "active" and finds the row
     * already inactive by the time it writes. PGlite cannot interleave two
     * requests, so the conditional update is driven directly.
     */
    it('moves no row when the category is already in the requested state', async () => {
      expect(await setCategoryActiveRow(harness.database.db, cateringId, true)).toBe(false);
      expect(await setCategoryActiveRow(harness.database.db, cateringId, false)).toBe(true);
      expect(await setCategoryActiveRow(harness.database.db, cateringId, false)).toBe(false);
    });

    it('drops a deactivated category from /categories and brings it back on reactivation', async () => {
      await setActive(cateringId, false);
      const hidden = await harness.app.inject({ method: 'GET', url: '/v1/categories' });
      expect(hidden.statusCode).toBe(200);
      expect((hidden.json() as Array<{ id: string }>).map((row) => row.id)).not.toContain(
        cateringId,
      );
      expect(hidden.json()).toHaveLength(CATEGORY_SEEDS.length - 1);

      await setActive(cateringId, true);
      const shown = await harness.app.inject({ method: 'GET', url: '/v1/categories' });
      expect((shown.json() as Array<{ id: string }>).map((row) => row.id)).toContain(cateringId);
    });

    it('drops a deactivated category from the search facets', async () => {
      await publishVendorInBoth();

      const before = await harness.app.inject({ method: 'GET', url: '/v1/vendors' });
      expect(before.statusCode).toBe(200);
      expect(before.json().facets.categories).toEqual(
        expect.arrayContaining([
          { categoryId: photographyId, count: 1 },
          { categoryId: cateringId, count: 1 },
        ]),
      );

      await setActive(cateringId, false);

      const after = await harness.app.inject({ method: 'GET', url: '/v1/vendors' });
      expect(after.json().facets.categories).toEqual([{ categoryId: photographyId, count: 1 }]);
    });

    it('drops it from search cards and stops the category filter matching it', async () => {
      await publishVendorInBoth();
      await setActive(cateringId, false);

      const cards = await harness.app.inject({ method: 'GET', url: '/v1/vendors' });
      expect(
        (cards.json().items as Array<{ categories: Array<{ slug: string }> }>)[0]!.categories.map(
          (category) => category.slug,
        ),
      ).toEqual(['photography']);

      const filtered = await harness.app.inject({
        method: 'GET',
        url: '/v1/vendors?category=catering',
      });
      expect(filtered.statusCode).toBe(200);
      expect(filtered.json().total).toBe(0);
    });

    /*
     * The editor cannot draw a hidden category, so it posts the held id back on
     * every save. Refusing it would lock the vendor out of their storefront.
     */
    it('lets a vendor listed under it keep saving their storefront, and keeps the link', async () => {
      await publishVendorInBoth();
      await setActive(cateringId, false);

      const saved = await harness.app.inject({
        method: 'PUT',
        url: '/v1/vendor/profile',
        headers: bearer(VENDOR),
        payload: { bio: 'Still two trades.', categoryIds: [photographyId, cateringId] },
      });
      expect(saved.statusCode).toBe(200);

      await setActive(cateringId, true);
      const admin = await harness.app.inject({
        method: 'GET',
        url: '/v1/admin/categories',
        headers: bearer(ADMIN),
      });
      expect(
        (admin.json().items as Array<{ id: string; vendorCount: number }>).find(
          (item) => item.id === cateringId,
        )?.vendorCount,
      ).toBe(1);
    });

    it('still refuses a hidden category the vendor was not already listed under', async () => {
      await publishVendorInBoth();
      const [decor] = (await categoryRows()).filter((row) => row.slug === 'decor');
      await setActive(decor!.id, false);

      const saved = await harness.app.inject({
        method: 'PUT',
        url: '/v1/vendor/profile',
        headers: bearer(VENDOR),
        payload: { categoryIds: [photographyId, decor!.id] },
      });
      expect(saved.statusCode).toBe(400);
    });
  });

  describe('reorder', () => {
    it('persists display_order and the public list follows it on the next read', async () => {
      const current = await categoryRows();
      const reversed = current.map((row) => row.id).reverse();

      const response = await reorder(reversed);

      expect(response.statusCode).toBe(200);
      expect((response.json().items as Array<{ id: string }>).map((item) => item.id)).toEqual(
        reversed,
      );
      expect((await categoryRows()).map((row) => row.displayOrder)).toEqual(
        reversed.map((_, index) => index + 1),
      );

      const publicList = await harness.app.inject({ method: 'GET', url: '/v1/categories' });
      expect((publicList.json() as Array<{ id: string }>).map((row) => row.id)).toEqual(reversed);
    });

    it('logs one row per category whose position changed, with where it was', async () => {
      // The seeds number 1..N, so swapping the first two moves exactly those two.
      const ids = (await categoryRows()).map((row) => row.id);
      const [first, second, ...rest] = ids;

      expect((await reorder([second!, first!, ...rest])).statusCode).toBe(200);

      const rows = (await newActions()).map((row) => ({
        action: row.action,
        subjectId: row.subjectId,
        detail: row.detail,
      }));
      expect(rows).toEqual(
        expect.arrayContaining([
          {
            action: 'category_reordered',
            subjectId: second,
            detail: { displayOrder: 1, previousDisplayOrder: 2 },
          },
          {
            action: 'category_reordered',
            subjectId: first,
            detail: { displayOrder: 2, previousDisplayOrder: 1 },
          },
        ]),
      );
      expect(rows).toHaveLength(2);
    });

    it('refuses a list that does not name every category, and changes nothing', async () => {
      const before = await categoryRows();
      const response = await reorder(before.slice(1).map((row) => row.id));

      expect(response.statusCode).toBe(409);
      expect(await categoryRows()).toEqual(before);
      expect(await newActions()).toEqual([]);
    });

    it('refuses a reorder built on an order another operator has since changed', async () => {
      const seen = (await categoryRows()).map((row) => row.id);
      const [first, second, third, ...rest] = seen;

      // Operator A swaps the first two.
      expect((await reorder([second!, first!, third!, ...rest], seen)).statusCode).toBe(200);
      const afterA = await categoryRows();

      // Operator B, still looking at the original order, moves the third up.
      const response = await reorder([first!, third!, second!, ...rest], seen);

      expect(response.statusCode).toBe(409);
      expect(await categoryRows()).toEqual(afterA);
    });

    it('refuses a list that names a category twice', async () => {
      const ids = (await categoryRows()).map((row) => row.id);

      const response = await reorder([ids[0]!, ...ids.slice(0, -1)]);

      expect(response.statusCode).toBe(400);
    });
  });
});
