import { categories, servicePackages, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  acceptVendorAgreementAs,
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * The vendor's own writes against each other, on a real Postgres.
 *
 * PGlite is one connection, so a `Promise.all` there runs each request's
 * statements in lock-step and passes with the row lock deleted (#399). The
 * admin path is covered in `admin/vendor-publish.contention.test.ts`; these are
 * the vendor-side entry points that share the same rows.
 */
describe('the vendor’s own storefront writes, against a real Postgres', () => {
  const VENDOR = 'user_vendor_own_one';
  const OTHER_VENDOR = 'user_vendor_own_two';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let photographyId: string;

  function profileBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      businessName: 'Fernbank Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      bio: 'Fernbank Studio photographs weddings across central Texas.',
      responseTimeHours: 24,
      ...overrides,
    };
  }

  /** A complete, unpublished storefront with exactly one bookable package. */
  async function seedStorefront(): Promise<{ vendorId: string; packageId: string }> {
    const profile = await harness!.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: profileBody(),
    });
    expect(profile.statusCode).toBe(201);

    const servicePackage = await harness!.app.inject({
      method: 'POST',
      url: '/v1/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
      },
    });
    expect(servicePackage.statusCode).toBe(201);
    await acceptVendorAgreementAs(harness!, VENDOR);

    return { vendorId: profile.json().id, packageId: servicePackage.json().id };
  }

  async function stateOf(vendorId: string): Promise<{ isPublished: boolean; active: number }> {
    const [profile] = await harness!.database.db
      .select({ isPublished: vendorProfiles.isPublished })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId))
      .limit(1);
    const active = await harness!.database.db
      .select({ id: servicePackages.id })
      .from(servicePackages)
      .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.isActive, true)));

    return { isPublished: profile!.isPublished, active: active.length };
  }

  beforeAll(async () => {
    // Four connections, so the requests can genuinely be in flight at once.
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const authUserId of [VENDOR, OTHER_VENDOR]) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'Vendor',
        roleHint: 'vendor',
        avatarUrl: null,
      });
      await signInAs(harness, authUserId);
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = photography!.id;
  });

  beforeEach(async () => {
    await harness!.database.db.delete(servicePackages);
    await harness!.database.db.delete(vendorProfiles);
  });

  afterAll(async () => {
    await harness?.database.db.delete(users);
    await harness?.close();
    await database?.close();
  });

  /**
   * The vendor publishing in one tab while switching their only package off in
   * another. Publish counted packages before its transaction and wrote after it;
   * the deactivation read the vendor before its own write and, finding it
   * unpublished, declined to unpublish. Each was right about the world it read.
   * Whichever serialises first, the pair must end at "not published", or
   * "published with something bookable" — never published with nothing.
   */
  it('never leaves a published storefront with no active package', async () => {
    const { vendorId, packageId } = await seedStorefront();

    const [publish, deactivate] = await Promise.all([
      harness!.app.inject({
        method: 'PUT',
        url: '/v1/vendor/profile',
        headers: bearer(VENDOR),
        payload: { isPublished: true },
      }),
      harness!.app.inject({
        method: 'PUT',
        url: `/v1/vendor/packages/${packageId}`,
        headers: bearer(VENDOR),
        payload: { isActive: false },
      }),
    ]);

    // The deactivation always applies; the publish is either undone by it or
    // refused for having nothing to publish.
    expect(deactivate.statusCode).toBe(200);
    expect([200, 400]).toContain(publish.statusCode);

    const state = await stateOf(vendorId);
    expect(state.active).toBe(0);
    expect(state.isPublished).toBe(false);
  });

  /**
   * Both requests pass the service's "no profile yet" read, so the loser is
   * stopped by `vendor_profiles_user_id_key`. It used to surface as a bare 500.
   */
  it('answers 409 to the loser of two concurrent creates for one vendor', async () => {
    const [first, second] = await Promise.all(
      ['First Studio', 'Second Studio'].map((businessName) =>
        harness!.app.inject({
          method: 'POST',
          url: '/v1/vendor/profile',
          headers: bearer(VENDOR),
          payload: profileBody({ businessName }),
        }),
      ),
    );

    expect([first!.statusCode, second!.statusCode].sort()).toEqual([201, 409]);
    const loser = first!.statusCode === 409 ? first! : second!;
    expect(loser.json().message).toBe('You already have a vendor profile');
  });

  /** The slug is checked, then written; two vendors can both pass the check. */
  it('answers 409 to the loser of two vendors claiming one slug', async () => {
    const [first, second] = await Promise.all(
      [VENDOR, OTHER_VENDOR].map((user) =>
        harness!.app.inject({
          method: 'POST',
          url: '/v1/vendor/profile',
          headers: bearer(user),
          payload: profileBody({ slug: 'shared-address' }),
        }),
      ),
    );

    const codes = [first!.statusCode, second!.statusCode].sort();
    // Slug resolution may also have seen the other row and suffixed its own,
    // which is the intended outcome when it wins the read; a 500 never is.
    expect(codes[0]).toBe(201);
    expect([201, 409]).toContain(codes[1]);
    if (codes[1] === 409) {
      const loser = first!.statusCode === 409 ? first! : second!;
      expect(loser.json().message).toBe('That web address was just taken. Choose another.');
    }
  });

  /**
   * Two tabs saving the profile from one version at the same moment (VEN-481).
   * The version is checked under a row lock; without it both read the old
   * version, both pass, and the earlier edit is lost. Exactly one may win.
   */
  it('lets exactly one of two simultaneous saves from one version through', async () => {
    await seedStorefront();
    const opened = await harness!.app.inject({
      method: 'GET',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
    });
    const version = opened.json().updatedAt as string;

    const responses = await Promise.all(
      ['First tab', 'Second tab'].map((tagline) =>
        harness!.app.inject({
          method: 'PUT',
          url: '/v1/vendor/profile',
          headers: bearer(VENDOR),
          payload: { tagline, updatedAt: version },
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
  });
});
