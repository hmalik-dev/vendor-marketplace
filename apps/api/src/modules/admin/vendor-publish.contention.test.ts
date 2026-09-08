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

  /**
   * **The vendor's own publish against the operator's takedown (#457).**
   *
   * The vendor's editor reads its row, decides, and writes several statements
   * later without taking a lock — so `moderation_hold` being false when it read
   * says nothing about the moment it writes. If that write does not carry the
   * hold in its own `WHERE`, an operator's takedown committing inside the window
   * is simply overwritten, and the row lands on the one state neither party can
   * get out of: `is_published = true` beside `moderation_hold = true`. The
   * storefront is back on search, the console labels the row `Held`, and the
   * operator's republish answers 409 because it is already published.
   *
   * **The assertion is order-independent, and the race is entered rather than
   * forced.** Whichever of the two commits first, the pair has to agree —
   * published implies not held, held implies not published — and the vendor's
   * own answer has to describe the state that was actually stored. Nothing here
   * *makes* the window open, so a future reader should not read a green run as
   * proof that it did; what the invariant does is make the bad state impossible
   * to reach without failing on any run that enters it.
   *
   * Measured, because "probably races" is the kind of claim that quietly stops
   * being true: with the `requireUnheld` option removed from
   * `updateVendorProfile`, this failed **three runs out of three** on
   * `is_published && moderation_hold`, and passed three out of three with it
   * back. The window is wide because the vendor's read is the first statement
   * of its request and the operator's whole transaction is shorter than the
   * four reads that follow it.
   */
  it('never leaves a storefront published and held at once', async () => {
    const published = await harness!.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: true },
    });
    expect(published.statusCode).toBe(200);

    const paused = await harness!.app.inject({
      method: 'PUT',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: { isPublished: false },
    });
    expect(paused.statusCode).toBe(200);

    const [vendorPublish, operatorHold] = await Promise.all([
      /* A whole-profile save, because that is the long pre-write path: slug
       * resolution, category and tag reads and two counts all sit between the
       * read that checks the hold and the write that acts on it. */
      harness!.app.inject({
        method: 'PUT',
        url: '/vendor/profile',
        headers: bearer(VENDOR),
        payload: {
          businessName: 'Fernbank Studio',
          bio: 'Fernbank Studio photographs weddings across central Texas and beyond.',
          responseTimeHours: 4,
          categoryIds: [photographyId],
          tagIds: [],
          isPublished: true,
        },
      }),
      harness!.app.inject({
        method: 'PUT',
        url: `/admin/vendors/${vendorId}/publish`,
        headers: bearer(ADMIN_ONE),
        payload: { isPublished: false },
      }),
    ]);

    const [row] = await harness!.database.db
      .select({
        isPublished: vendorProfiles.isPublished,
        moderationHold: vendorProfiles.moderationHold,
      })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, vendorId))
      .limit(1);

    expect(operatorHold.statusCode).toBe(200);
    expect(row!.moderationHold).toBe(true);

    /* The invariant, both halves. */
    expect(row!.isPublished && row!.moderationHold).toBe(false);

    /*
     * And the vendor was told the truth. A 200 that left the storefront down,
     * or a 403 beside a published row, is the same defect wearing the other
     * answer — the vendor acts on what they were told, not on the column.
     */
    expect([200, 403]).toContain(vendorPublish.statusCode);
    expect(vendorPublish.statusCode === 200).toBe(row!.isPublished);
  });
});
