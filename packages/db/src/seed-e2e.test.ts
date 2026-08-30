import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedReferenceData } from './seed.js';
import { E2E_VENDOR_SLUG, seedE2eFixtures, type E2eSeedInput } from './seed-e2e.js';
import {
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

  beforeEach(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    await seedReferenceData(database.db);
  });

  afterAll(async () => {
    await database?.close();
  });

  it('gives the vendor account a published storefront, a package and a live request', async () => {
    const result = await seedE2eFixtures(database.db, INPUT);

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
  it('marks the vendor able to take payment, so accept is not blocked by the payout gate', async () => {
    const result = await seedE2eFixtures(database.db, INPUT);

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

    const result = await seedE2eFixtures(database.db, INPUT);

    const [row] = await database.db.select().from(users).where(eq(users.id, result.vendorUserId));
    expect(row?.role).toBe('vendor');
  });

  it('is idempotent — a second run adopts its own rows rather than duplicating them', async () => {
    const first = await seedE2eFixtures(database.db, INPUT);
    const second = await seedE2eFixtures(database.db, INPUT);

    expect(second.vendorProfileId).toBe(first.vendorProfileId);
    expect(second.packageId).toBe(first.packageId);
    expect(second.bookingRequestId).toBe(first.bookingRequestId);

    expect(await database.db.select().from(vendorProfiles)).toHaveLength(1);
    expect(await database.db.select().from(servicePackages)).toHaveLength(1);
    expect(await database.db.select().from(bookingRequests)).toHaveLength(1);
    expect(await database.db.select().from(users)).toHaveLength(2);
  });

  /*
   * The hazard the whole design turns on. `insertUserIfAbsent` absorbs a
   * conflict on `clerk_user_id` and nothing else, so a fixture that invented an
   * id would leave this email attached to the wrong identity — and the account's
   * first real sign-in would collide on the email index, throw, and lock the
   * account out. Attaching by the real id is what makes a later sign-in a no-op.
   */
  it('leaves a later sign-in for the same identity able to find its row', async () => {
    const result = await seedE2eFixtures(database.db, INPUT);

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

  it('refuses clearly when reference data has not been seeded', async () => {
    const empty = await createTestDatabase();
    await empty.runMigrations();

    await expect(seedE2eFixtures(empty.db, INPUT)).rejects.toThrow(/pnpm db:seed/);

    await empty.close();
  });
});
