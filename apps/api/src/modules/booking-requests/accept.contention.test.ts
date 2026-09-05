import {
  availability,
  bookingRequests,
  categories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { addDays, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * #399, acceptance 2 — the debt the PGlite suite could not pay.
 *
 * Two vendors' worth of customers cannot both buy one evening. `transitionRequest`
 * stops that by taking the date's `availability` row (`lockHeldDate`) inside the
 * transaction that writes `accepted`, so the second accept blocks until the
 * first commits and then sees a rival.
 *
 * The route suite fires the same two accepts with `Promise.all` and passes
 * either way: PGlite is one connection, so its second transaction starts after
 * the first has finished and the lock is never load-bearing. Deleting
 * `lockHeldDate` leaves that test green. This one runs the same routes against
 * a pooled Postgres, where the two requests really do overlap — and deleting
 * `lockHeldDate` turns it red with two `accepted` rows, which is the
 * fail-before evidence the ticket asked for.
 */
describe('two accepts on one vendor date, on two real connections', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const OTHER_CUSTOMER = 'user_customer_two';
  const EVENT_DATE = toDateString(addDays(new Date(), 30));

  /*
   * Held here rather than inside `beforeAll`, because the harness is what
   * closes it and the harness may not exist: anything that throws between
   * creating the database and building the server would otherwise strand a
   * fully migrated database on the server for good.
   */
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorId: string;
  let firstRequestId: string;
  let secondRequestId: string;

  async function post(
    clerkUserId: string,
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness!.app.inject({
      method: 'POST',
      url,
      headers: bearer(clerkUserId),
      ...(payload ? { payload } : {}),
    });
  }

  beforeAll(async () => {
    /*
     * Two is the whole point — one connection per accept. Four leaves room for
     * the assertions this suite makes while nothing is blocked.
     */
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OTHER_CUSTOMER, 'customer', 'edsger@example.com'],
    ] as const) {
      harness!.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const [photography] = await harness!.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await post(VENDOR, '/vendor/profile', {
      businessName: 'Sunlit Studio',
      categoryIds: [photography!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    vendorId = profile.json().id;

    const servicePackage = await post(VENDOR, '/vendor/packages', {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: 145_000,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
    });
    expect(servicePackage.statusCode).toBe(201);
    const packageId: string = servicePackage.json().id;

    /*
     * A request can only be sent to a storefront that is published and able to
     * take payment. The pair travels together — `vendor_profiles` refuses
     * onboarding without an account id (#381).
     */
    await harness!.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    const detail = {
      vendorId,
      packageId,
      eventDate: EVENT_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      eventStartTime: '14:00',
      guestCount: 120,
    };

    const mine = await post(CUSTOMER, '/booking-requests', detail);
    const theirs = await post(OTHER_CUSTOMER, '/booking-requests', detail);
    expect([mine.statusCode, theirs.statusCode]).toEqual([201, 201]);
    firstRequestId = mine.json().id;
    secondRequestId = theirs.json().id;
  });

  afterAll(async () => {
    // `afterAll` still runs when `beforeAll` threw, so both halves are guarded
    // — and the database is closed directly when no harness ever took it.
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('lets exactly one win, and refuses the other with a 409', async () => {
    const responses = await Promise.all([
      post(VENDOR, `/booking-requests/${firstRequestId}/accept`),
      post(VENDOR, `/booking-requests/${secondRequestId}/accept`),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);

    const loser = responses.find((response) => response.statusCode === 409);
    expect(loser?.json().message).toBe('That date was booked while this request was open');

    const rows = await harness!.database.db
      .select({ id: bookingRequests.id, status: bookingRequests.status })
      .from(bookingRequests);

    expect(rows.filter((row) => row.status === 'accepted')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'pending')).toHaveLength(1);
  });

  it('holds the date exactly once, as booked', async () => {
    const rows = await harness!.database.db
      .select({ date: availability.date, status: availability.status })
      .from(availability)
      .where(eq(availability.vendorId, vendorId));

    expect(rows).toEqual([{ date: EVENT_DATE, status: 'booked' }]);
  });
});
