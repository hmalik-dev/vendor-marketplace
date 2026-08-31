import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedReferenceData } from './seed.js';
import {
  E2E_VENDOR_SLUG,
  seedE2eFixtures,
  type E2eSeedInput,
  type E2eSeedResult,
} from './seed-e2e.js';
import {
  availability,
  bookingRequests,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

/**
 * The fixture exists because signing in creates a `users` row and nothing else —
 * `vendor_profiles` is only ever written by `POST /vendor/profile` — so the
 * end-to-end vendor account lands on an empty profile form and every `/vendor`
 * route redirects there, blocking the browser gate on every vendor ticket.
 */
describe('seedE2eFixtures', () => {
  let database: TestDatabase;

  const INPUT: E2eSeedInput = {
    vendor: {
      clerkUserId: 'user_e2e_vendor',
      email: 'vendor+clerk_test@example.com',
      firstName: 'Evie',
      lastName: 'Vendor',
    },
    customer: {
      clerkUserId: 'user_e2e_customer',
      email: 'customer+clerk_test@example.com',
      firstName: 'Cal',
      lastName: 'Customer',
    },
    now: new Date('2026-08-30T00:00:00.000Z'),
  };

  /**
   * Narrows the published fixture's result.
   *
   * `packageId`, `bookingRequestId` and `eventDate` are nullable because
   * `storefront: 'draft'` seeds none of them. Asserting them here rather than
   * reaching for `!` keeps the published contract stated: a published seed that
   * ever returned null would fail on this line instead of somewhere downstream.
   */
  function published(
    result: E2eSeedResult,
  ): E2eSeedResult & { packageId: string; bookingRequestId: string; eventDate: string } {
    expect(result.packageId).not.toBeNull();
    expect(result.bookingRequestId).not.toBeNull();
    expect(result.eventDate).not.toBeNull();

    return result as E2eSeedResult & {
      packageId: string;
      bookingRequestId: string;
      eventDate: string;
    };
  }

  beforeEach(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    await seedReferenceData(database.db);
  });

  afterAll(async () => {
    await database?.close();
  });

  it('gives the vendor account a published storefront, a package and a live request', async () => {
    const result = published(await seedE2eFixtures(database.db, INPUT));

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, result.vendorProfileId));

    expect(profile?.slug).toBe(E2E_VENDOR_SLUG);
    expect(profile?.userId).toBe(result.vendorUserId);
    expect(profile?.isPublished).toBe(true);

    const packages = await database.db
      .select()
      .from(servicePackages)
      .where(eq(servicePackages.vendorId, result.vendorProfileId));
    expect(packages).toHaveLength(1);
    expect(packages[0]?.priceCents).toBe(145_000);

    const requests = await database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.vendorId, result.vendorProfileId));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.status).toBe('pending');
    expect(requests[0]?.customerId).toBe(result.customerUserId);
    // 45 days on from the pinned "now", so the event never drifts into the past.
    expect(requests[0]?.eventDate).toBe('2026-10-14');

    const filed = await database.db
      .select()
      .from(vendorCategories)
      .where(eq(vendorCategories.vendorId, result.vendorProfileId));
    expect(filed).toHaveLength(1);
  });

  /*
   * The 402 this clears is `accept` refusing until Stripe reports both
   * capabilities active — a round trip no unattended run can complete, because
   * Stripe's hosted form is behind a captcha.
   */
  /*
   * `/admin` is gated on `users.role = 'admin'`, and that role cannot be reached
   * from inside the product: it is read from Clerk's `unsafeMetadata` at first
   * sign-in, falls back to `customer`, and is immutable afterwards. So no
   * sign-up flow produces an admin, `seed-demo.ts` gives its admin a synthetic
   * `clerk_user_id` that cannot authenticate, and before this the only route to
   * the operations console was promoting a customer in the database by hand.
   */
  it('grants the admin account the operations role', async () => {
    const result = await seedE2eFixtures(database.db, {
      ...INPUT,
      admin: {
        clerkUserId: 'user_e2e_admin',
        email: 'admin+clerk_test@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
      },
    });

    expect(result.adminUserId).toBeDefined();

    const [row] = await database.db
      .select({ role: users.role, email: users.email, clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.id, result.adminUserId as string));

    expect(row?.role).toBe('admin');
    expect(row?.email).toBe('admin+clerk_test@example.com');
    expect(row?.clerkUserId).toBe('user_e2e_admin');
  });

  /*
   * Optional on purpose. A checkout whose `.env.e2e.local` predates the admin
   * account must still seed the vendor and customer fixtures rather than
   * failing outright on a gitignored file it cannot fix for itself.
   */
  it('seeds the vendor and customer fixtures with no admin account at all', async () => {
    const result = await seedE2eFixtures(database.db, INPUT);

    expect(result.adminUserId).toBeUndefined();
    expect(result.vendorProfileId).toBeDefined();

    const admins = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'));
    expect(admins).toEqual([]);
  });

  /*
   * The role is *forced*, like the vendor's. An account that signed up without
   * the metadata hint has a `customer` row nothing in the application can
   * correct, so adopting it rather than overwriting would leave `/admin`
   * unreachable with a green seed.
   */
  it('promotes an account Clerk had already created as a customer to admin', async () => {
    await database.db.insert(users).values({
      clerkUserId: 'user_e2e_admin',
      email: 'admin+clerk_test@example.com',
      role: 'customer',
      firstName: 'Ada',
      lastName: 'Admin',
    });

    const result = await seedE2eFixtures(database.db, {
      ...INPUT,
      admin: {
        clerkUserId: 'user_e2e_admin',
        email: 'admin+clerk_test@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
      },
    });

    const [row] = await database.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, result.adminUserId as string));

    expect(row?.role).toBe('admin');
  });

  it('marks the vendor able to take payment, so accept is not blocked by the payout gate', async () => {
    const result = published(await seedE2eFixtures(database.db, INPUT));

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, result.vendorProfileId));

    expect(profile?.stripeOnboarded).toBe(true);
  });

  it('can leave the payout gate closed, for a run that wants to drive it', async () => {
    const result = await seedE2eFixtures(database.db, { ...INPUT, payoutsReady: false });

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, result.vendorProfileId));

    expect(profile?.stripeOnboarded).toBe(false);
  });

  /*
   * The role comes from Clerk's `unsafeMetadata` at first sign-in and falls back
   * to `customer` for anything unrecognised — so an end-to-end vendor that
   * signed up without the hint has a `customer` row and every vendor guard
   * refuses it. The fixture has to correct that, not assume it.
   */
  it('promotes an account Clerk had already created as a customer', async () => {
    await database.db.insert(users).values({
      clerkUserId: INPUT.vendor.clerkUserId,
      email: INPUT.vendor.email,
      role: 'customer',
      firstName: 'Evie',
      lastName: 'Vendor',
    });

    const result = published(await seedE2eFixtures(database.db, INPUT));

    const [row] = await database.db.select().from(users).where(eq(users.id, result.vendorUserId));
    expect(row?.role).toBe('vendor');
  });

  it('is idempotent — a second run adopts its own rows rather than duplicating them', async () => {
    const first = published(await seedE2eFixtures(database.db, INPUT));
    const second = published(await seedE2eFixtures(database.db, INPUT));

    expect(second.vendorProfileId).toBe(first.vendorProfileId);
    expect(second.packageId).toBe(first.packageId);
    expect(second.bookingRequestId).toBe(first.bookingRequestId);

    expect(await database.db.select().from(vendorProfiles)).toHaveLength(1);
    expect(await database.db.select().from(servicePackages)).toHaveLength(1);
    expect(await database.db.select().from(bookingRequests)).toHaveLength(1);
    expect(await database.db.select().from(users)).toHaveLength(2);
  });

  /*
   * The two payout columns move together (#371).
   *
   * `stripe_onboarded = true` with a null `stripe_account_id` is a state the
   * product cannot reach -- the real flow claims the account id first and flips
   * the flag later -- and the fixture was producing it, which made
   * `/bookings/<id>/checkout` a 404 for the end-to-end customer.
   */
  it('writes an account id whenever it marks the vendor payout-ready', async () => {
    const result = published(await seedE2eFixtures(database.db, INPUT));

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, result.vendorProfileId));

    expect(profile?.stripeOnboarded).toBe(true);
    expect(profile?.stripeAccountId).toBe('acct_e2e_fixture_not_a_real_account');
  });

  it('leaves both payout columns empty when payouts are not ready', async () => {
    const result = published(await seedE2eFixtures(database.db, { ...INPUT, payoutsReady: false }));

    const [profile] = await database.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.id, result.vendorProfileId));

    expect(profile?.stripeOnboarded).toBe(false);
    expect(profile?.stripeAccountId).toBeNull();
  });

  /*
   * The draft storefront (#371).
   *
   * Frame `27 Vendor dashboard - empty . 1024` draws an unpublished profile
   * beside `Requests 0`, and no seeded row could produce it: all 17 profiles are
   * published and this is the only account with a sign-in path, so the frame was
   * unrenderable and any parity pass over it proved nothing.
   */
  describe('storefront: draft', () => {
    it('leaves the vendor unpublished with no requests', async () => {
      const result = await seedE2eFixtures(database.db, { ...INPUT, storefront: 'draft' });

      const [profile] = await database.db
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, result.vendorProfileId));

      expect(profile?.isPublished).toBe(false);
      expect(profile?.isDeleted).toBe(false);
      expect(await database.db.select().from(bookingRequests)).toHaveLength(0);
      expect(result.bookingRequestId).toBeNull();
      expect(result.packageId).toBeNull();
      expect(result.eventDate).toBeNull();
    });

    /*
     * The state the frame never draws, and the reason the requests are deleted
     * rather than skipped: the account is long-lived, so a draft seeded after
     * any earlier pass would otherwise be an unpublished storefront with
     * requests still waiting on it.
     */
    it('clears the requests a previous published run left behind', async () => {
      const seeded = published(await seedE2eFixtures(database.db, INPUT));

      expect(await database.db.select().from(bookingRequests)).toHaveLength(1);

      const drafted = await seedE2eFixtures(database.db, { ...INPUT, storefront: 'draft' });

      expect(drafted.vendorProfileId).toBe(seeded.vendorProfileId);
      expect(await database.db.select().from(bookingRequests)).toHaveLength(0);
    });

    /*
     * The undo. `draft` has no separate restore script because re-running the
     * default is the restore -- which is only true if it really republishes and
     * really puts a request back.
     */
    it('is undone by re-running the published seed', async () => {
      await seedE2eFixtures(database.db, { ...INPUT, storefront: 'draft' });

      const restored = published(await seedE2eFixtures(database.db, INPUT));

      const [profile] = await database.db
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, restored.vendorProfileId));

      expect(profile?.isPublished).toBe(true);
      expect(await database.db.select().from(bookingRequests)).toHaveLength(1);
    });
  });

  /*
   * The hazard the whole design turns on. `insertUserIfAbsent` absorbs a
   * conflict on `clerk_user_id` and nothing else, so a fixture that invented an
   * id would leave this email attached to the wrong identity — and the account's
   * first real sign-in would collide on the email index, throw, and lock the
   * account out. Attaching by the real id is what makes a later sign-in a no-op.
   */
  it('leaves a later sign-in for the same identity able to find its row', async () => {
    const result = published(await seedE2eFixtures(database.db, INPUT));

    // What `insertUserIfAbsent` does on the account's next authenticated request.
    const inserted = await database.db
      .insert(users)
      .values({
        clerkUserId: INPUT.vendor.clerkUserId,
        email: INPUT.vendor.email,
        role: 'customer',
        firstName: 'Evie',
        lastName: 'Vendor',
      })
      .onConflictDoNothing({ target: users.clerkUserId })
      .returning();

    expect(inserted).toHaveLength(0);

    const [found] = await database.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, INPUT.vendor.clerkUserId));
    expect(found?.id).toBe(result.vendorUserId);
    // The sign-in must not demote the fixture's role back to customer.
    expect(found?.role).toBe('vendor');
  });

  /*
   * The state a browser pass leaves behind the first time it exercises
   * `POST /vendor/profile`. `vendor_profiles` carries a unique index on
   * `user_id` as well as on `slug`, and an upsert can only name one — so
   * conflicting on `slug` dies here on the machine this fixture exists to fix.
   */
  it('adopts a profile the vendor already owns under some other slug', async () => {
    const [vendorUser] = await database.db
      .insert(users)
      .values({
        clerkUserId: INPUT.vendor.clerkUserId,
        email: INPUT.vendor.email,
        role: 'vendor',
        firstName: 'Evie',
        lastName: 'Vendor',
      })
      .returning({ id: users.id });

    await database.db.insert(vendorProfiles).values({
      userId: vendorUser!.id,
      businessName: 'Probe Test Studio',
      slug: 'probe-test-studio',
      isPublished: false,
      stripeOnboarded: false,
    });

    const result = published(await seedE2eFixtures(database.db, INPUT));

    const profiles = await database.db.select().from(vendorProfiles);
    expect(profiles).toHaveLength(1);
    // Adopted in place, slug intact — not replaced, and not duplicated.
    expect(profiles[0]?.slug).toBe('probe-test-studio');
    expect(profiles[0]?.id).toBe(result.vendorProfileId);
    expect(profiles[0]?.isPublished).toBe(true);
    expect(profiles[0]?.stripeOnboarded).toBe(true);
  });

  /*
   * `booking_requests_live_package_key` is partial on `pending` **and**
   * `quoted`, so a fixture probing only for `pending` finds nothing once a
   * browser pass has sent a quote — then inserts, and dies on that index.
   */
  it('reuses a request that has moved from pending to quoted', async () => {
    const first = published(await seedE2eFixtures(database.db, INPUT));

    await database.db
      .update(bookingRequests)
      .set({ status: 'quoted', quotedPriceCents: 160_000 })
      .where(eq(bookingRequests.id, first.bookingRequestId));

    const second = published(await seedE2eFixtures(database.db, INPUT));

    expect(second.bookingRequestId).toBe(first.bookingRequestId);
    expect(await database.db.select().from(bookingRequests)).toHaveLength(1);
  });

  /*
   * A row the application could not have created is a fixture that makes every
   * pass measuring it measure a state real data never reaches: no price on the
   * dashboard, no countdown, and a quote allowed on a package request.
   */
  it('shapes the request the way the service shapes one', async () => {
    const result = published(await seedE2eFixtures(database.db, INPUT));

    const [request] = await database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, result.bookingRequestId));

    expect(request?.finalPriceCents).toBe(145_000);
    expect(request?.packageId).toBe(result.packageId);
    expect(request?.expiresAt).toBeInstanceOf(Date);
    // Seven days on from the pinned "now", as `createBookingRequest` locks it.
    expect(request?.expiresAt?.toISOString().slice(0, 10)).toBe('2026-09-06');
  });

  /*
   * The state every database seeded before this fixture learned to lock a price
   * is already in. Adopting the row untouched leaves the dashboard showing
   * "quote needed" and no countdown for ever, because the early return means
   * re-seeding never reaches the insert that would get it right.
   */
  it('repairs a live request left without a price or an expiry', async () => {
    const first = published(await seedE2eFixtures(database.db, INPUT));

    // Exactly what the previous fixture wrote.
    await database.db
      .update(bookingRequests)
      .set({ finalPriceCents: null, expiresAt: null })
      .where(eq(bookingRequests.id, first.bookingRequestId));

    const second = published(await seedE2eFixtures(database.db, INPUT));

    expect(second.bookingRequestId).toBe(first.bookingRequestId);

    const [repaired] = await database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, first.bookingRequestId));

    expect(repaired?.finalPriceCents).toBe(145_000);
    expect(repaired?.expiresAt).toBeInstanceOf(Date);
  });

  /** A price already locked is never overwritten — repair fills nulls only. */
  it('leaves a price that is already locked alone', async () => {
    const first = published(await seedE2eFixtures(database.db, INPUT));

    await database.db
      .update(bookingRequests)
      .set({ finalPriceCents: 99_000 })
      .where(eq(bookingRequests.id, first.bookingRequestId));

    await seedE2eFixtures(database.db, INPUT);

    const [untouched] = await database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, first.bookingRequestId));

    expect(untouched?.finalPriceCents).toBe(99_000);
  });

  /*
   * After an accept marks the date `booked`, a re-seed landing on that same
   * date would create a request that can never be accepted — 409 from
   * `prepareTransition`. The fixture has to survive its own previous run.
   */
  it('steps past a date the vendor has already booked', async () => {
    const first = published(await seedE2eFixtures(database.db, INPUT));

    await database.db
      .update(bookingRequests)
      .set({ status: 'accepted' })
      .where(eq(bookingRequests.id, first.bookingRequestId));
    await database.db.insert(availability).values({
      vendorId: first.vendorProfileId,
      date: first.eventDate,
      status: 'booked',
    });

    const second = published(await seedE2eFixtures(database.db, INPUT));

    expect(second.bookingRequestId).not.toBe(first.bookingRequestId);
    expect(second.eventDate).not.toBe(first.eventDate);
    expect(second.eventDate > first.eventDate).toBe(true);
  });

  /*
   * A half-applied run grants the vendor role and leaves no fixture — which
   * reads as healthy to anything checking the role alone.
   */
  it('applies nothing at all when a later step fails', async () => {
    const empty = await createTestDatabase();
    await empty.runMigrations();

    await expect(seedE2eFixtures(empty.db, INPUT)).rejects.toThrow(/pnpm db:seed/);

    // The account upserts ran before the category lookup threw.
    expect(await empty.db.select().from(users)).toHaveLength(0);

    await empty.close();
  });

  it('refuses clearly when reference data has not been seeded', async () => {
    const empty = await createTestDatabase();
    await empty.runMigrations();

    await expect(seedE2eFixtures(empty.db, INPUT)).rejects.toThrow(/pnpm db:seed/);

    await empty.close();
  });
});
