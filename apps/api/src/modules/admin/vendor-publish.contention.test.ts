import { categories, servicePackages, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * Two moderation writers reaching one vendor at once — the debt PGlite cannot pay.
 *
 * `setVendorPublished` and `setPackageActive` both **decide from a count of the
 * vendor's active packages and then write**, which makes them the same class of
 * read-then-write the review path already locks for. They share exactly one row,
 * the vendor profile, and that is the row both now take `FOR NO KEY UPDATE` on.
 *
 * PGlite is one connection, so its `db.transaction` callbacks run to completion
 * one after another and a `Promise.all` there passes with the lock deleted
 * (#399). Found by the security audit rather than by a failing test, which is
 * exactly why it needs a suite that can actually interleave.
 */
describe('two moderation writers on one vendor, against a real Postgres', () => {
  const ADMIN_ONE = 'user_admin_pub_one';
  const ADMIN_TWO = 'user_admin_pub_two';
  const VENDOR = 'user_vendor_pub';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let photographyId: string;
  let vendorId: string;
  let packageId: string;

  /** A complete, publishable storefront with exactly one bookable package. */
  async function seedVendor(): Promise<void> {
    const profile = await harness!.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Fernbank Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);
    vendorId = profile.json().id;

    const servicePackage = await harness!.app.inject({
      method: 'POST',
      url: '/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
      },
    });
    expect(servicePackage.statusCode).toBe(201);
    packageId = servicePackage.json().id;
  }

  async function vendorState(): Promise<{ isPublished: boolean; activePackages: number }> {
    const [profile] = await harness!.database.db
      .select({ isPublished: vendorProfiles.isPublished })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId))
      .limit(1);

    const active = await harness!.database.db
      .select({ id: servicePackages.id })
      .from(servicePackages)
      .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.isActive, true)));

    return {
      isPublished: profile!.isPublished,
      activePackages: active.length,
    };
  }

  beforeAll(async () => {
    // Four connections, so both requests can genuinely be in flight at once.
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [clerkUserId, role] of [
      [ADMIN_ONE, 'customer'],
      [ADMIN_TWO, 'customer'],
      [VENDOR, 'vendor'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    await signInAs(harness, VENDOR);
    await signInAs(harness, ADMIN_ONE, true);
    await signInAs(harness, ADMIN_TWO, true);

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
    await seedVendor();
  });

  afterAll(async () => {
    await harness?.database.db.delete(users);
    await harness?.close();
    await database?.close();
  });

  it('lets exactly one of two concurrent unpublishes through', async () => {
    const published = await harness!.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);

    const unpublish = (actor: string) =>
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendorId}/publish`,
        headers: bearer(actor),
        payload: { isPublished: false },
      });

    const [first, second] = await Promise.all([unpublish(ADMIN_ONE), unpublish(ADMIN_TWO)]);

    /*
     * 200 and 409, in whichever order the two connections won. Two 200s would
     * mean both operators were told they had taken the storefront down, and
     * both appended an audit row where one is owed a conflict.
     */
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    expect((await vendorState()).isPublished).toBe(false);
  });

  /**
   * **The state `publishBlockers` exists to make impossible.**
   *
   * Publishing reads "one active package" while the other transaction commits
   * that package's deactivation and finds `is_published` still false, so
   * `unpublishForMissingPackages` declines to act — and the storefront ends up
   * live with nothing on it that a customer can book. Whichever way the two
   * serialise, the answer has to be the same: not published, or published with
   * something bookable. Never published with nothing.
   */
  it('never leaves a published storefront with no bookable package', async () => {
    const [publish, deactivate] = await Promise.all([
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendorId}/publish`,
        headers: bearer(ADMIN_ONE),
        payload: { isPublished: true },
      }),
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/packages/${packageId}/active`,
        headers: bearer(ADMIN_TWO),
        payload: { isActive: false },
      }),
    ]);

    // The deactivation always applies; the publish either succeeds and is
    // undone by it, or is refused for having nothing to publish.
    expect(deactivate.statusCode).toBe(200);
    expect([200, 400]).toContain(publish.statusCode);

    const state = await vendorState();
    expect(state.activePackages).toBe(0);
    expect(state.isPublished).toBe(false);
  });
});
