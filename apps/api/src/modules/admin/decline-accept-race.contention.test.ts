import {
  availability,
  bookingRequests,
  categories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 * VEN-621 — an unwind declining a customer's *pending* request must not race a
 * rival's concurrent accept of the same date.
 *
 * `declineOpenRequests` recomputes the calendar cell for every request it
 * declines, including a pending one that never held the date itself. Without
 * taking the date's lock first, that recompute can read the date as free while
 * a rival's accept is mid-transaction, and then delete the `booked` cell once
 * that accept commits a moment later — a real accepted booking left
 * advertising the date as open. PGlite is one connection and cannot reproduce
 * this at all (`testing.md`), so this runs on real pooled Postgres.
 */
describe('declining a pending request while a rival accepts the same date', () => {
  /*
   * Below `ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR` (10): each trial bans a fresh
   * customer, and the hourly ceiling on bans and closures is real per-operator
   * state, not something a test clock can fast-forward past.
   */
  const TRIALS = 8;
  const ADMIN = 'user_race_admin';
  const VENDOR = 'user_race_vendor';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorId: string;
  let packageId: string;

  async function newCustomer(authUserId: string): Promise<string> {
    harness!.authUsers.set(authUserId, {
      authUserId,
      email: `${authUserId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'customer',
      avatarUrl: null,
    });
    return signInAs(harness!, authUserId);
  }

  /** A `pending` request for one date, made through the real route. */
  async function pendingRequestFor(authUserId: string, eventDate: string): Promise<string> {
    const created = await harness!.app.inject({
      method: 'POST',
      url: '/v1/booking-requests',
      headers: bearer(authUserId),
      payload: {
        vendorId,
        packageId,
        eventDate,
        eventType: 'wedding',
        eventLocation: 'Barr Mansion, Austin, TX',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    return created.json().id as string;
  }

  async function heldDateStatus(eventDate: string): Promise<string | null> {
    const rows = await harness!.database.db
      .select({ status: availability.status })
      .from(availability)
      .where(and(eq(availability.vendorId, vendorId), eq(availability.date, eventDate)));
    return rows[0]?.status ?? null;
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 8 });
    harness = await createTestHarness({ database });

    for (const [authUserId, roleHint] of [
      [VENDOR, 'vendor'],
      [ADMIN, 'customer'],
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
    await signInAs(harness, ADMIN, true);

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode, profile.body).toBe(201);
    vendorId = profile.json().id;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_race_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    const agreed = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/agreement/accept',
      headers: bearer(VENDOR),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
    expect(agreed.statusCode, agreed.body).toBe(200);

    const servicePackage = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/packages',
      headers: bearer(VENDOR),
      payload: {
        name: 'Full day coverage',
        description: 'Six hours of coverage with two photographers on site.',
        priceCents: 145_000,
        priceType: 'fixed',
        inclusions: ['6 hours', '2 photographers'],
      },
    });
    expect(servicePackage.statusCode, servicePackage.body).toBe(201);
    packageId = servicePackage.json().id;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('never leaves an accepted rival’s date unheld, across many trials', async () => {
    for (let trial = 0; trial < TRIALS; trial += 1) {
      const eventDate = toDateString(addDays(new Date(), 70 + trial));
      const bannedCustomer = `user_race_banned_${trial}`;
      const rivalCustomer = `user_race_rival_${trial}`;

      const bannedUserId = await newCustomer(bannedCustomer);
      await newCustomer(rivalCustomer);

      const declinedRequestId = await pendingRequestFor(bannedCustomer, eventDate);
      const rivalRequestId = await pendingRequestFor(rivalCustomer, eventDate);

      const [banResponse, acceptResponse] = await Promise.all([
        harness!.app.inject({
          method: 'PUT',
          url: `/v1/admin/users/${bannedUserId}/ban`,
          headers: bearer(ADMIN),
        }),
        harness!.app.inject({
          method: 'POST',
          url: `/v1/booking-requests/${rivalRequestId}/accept`,
          headers: bearer(VENDOR),
        }),
      ]);

      expect(banResponse.statusCode, banResponse.body).toBe(200);
      expect(acceptResponse.statusCode, acceptResponse.body).toBe(200);

      const declinedRow = await harness!.database.db
        .select({ status: bookingRequests.status })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, declinedRequestId));
      expect(declinedRow[0]?.status).toBe('declined');

      // The invariant the race broke: an accepted rival's date read as empty.
      expect(await heldDateStatus(eventDate)).toBe('booked');
    }
  });
});
