import {
  availability,
  bookingRequests,
  categories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * VEN-621 — a `pending` request whose window has already closed must not
 * leave a `pending` calendar cell behind when many reads race to age it.
 *
 * `ageIfExpired` takes the date's lock (`lockHeldDate`) before it checks
 * whether it is the one that gets to expire the row. `lockHeldDate` upserts
 * `pending` when the date holds nothing yet, so a loser that finds `applyExpiry`
 * already spoken for by the winner still has to undo the placeholder it just
 * inserted — otherwise the date reads `pending` forever, for a request nobody
 * can any longer act on. PGlite is one connection and cannot reproduce the
 * race at all (`testing.md`), so this runs on a real pooled Postgres.
 */
describe('many concurrent reads of one expired pending request', () => {
  const CONCURRENCY = 16;
  const TRIALS = 20;

  const VENDOR = 'user_expiry_race_vendor';
  const CUSTOMER = 'user_expiry_race_customer';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorId: string;
  let packageId: string;

  async function post(
    authUserId: string,
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness!.app.inject({
      method: 'POST',
      url,
      headers: bearer(authUserId),
      ...(payload ? { payload } : {}),
    });
  }

  async function get(
    authUserId: string,
    url: string,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness!.app.inject({ method: 'GET', url, headers: bearer(authUserId) });
  }

  /** A `pending` request already past its reply window, holding no date yet. */
  async function lapsedPendingRequest(eventDate: string): Promise<string> {
    const created = await post(CUSTOMER, '/v1/booking-requests', {
      vendorId,
      packageId,
      eventDate,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      customDetails: 'Full-day documentary coverage for about a hundred guests.',
    });
    expect(created.statusCode, created.body).toBe(201);
    const requestId = created.json().id as string;

    await harness!.database.db
      .update(bookingRequests)
      .set({ expiresAt: addDays(new Date(), -1) })
      .where(eq(bookingRequests.id, requestId));

    return requestId;
  }

  async function heldDateStatus(eventDate: string): Promise<string | null> {
    const rows = await harness!.database.db
      .select({ status: availability.status })
      .from(availability)
      .where(and(eq(availability.vendorId, vendorId), eq(availability.date, eventDate)));

    return rows[0]?.status ?? null;
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: CONCURRENCY + 4 });
    harness = await createTestHarness({ database });

    for (const [authUserId, role] of [
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await post(VENDOR, '/v1/vendor/profile', {
      businessName: 'Sunlit Studio',
      categoryIds: [photography!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode, profile.body).toBe(201);
    vendorId = profile.json().id;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    const agreed = await post(VENDOR, '/v1/vendor/agreement/accept', {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(agreed.statusCode, agreed.body).toBe(200);

    const servicePackage = await post(VENDOR, '/v1/vendor/packages', {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: 145_000,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
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

  it('leaves no availability row for the date, across many trials', async () => {
    for (let trial = 0; trial < TRIALS; trial += 1) {
      const eventDate = toDateString(addDays(new Date(), 60 + trial));
      const requestId = await lapsedPendingRequest(eventDate);

      const responses = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          get(CUSTOMER, `/v1/booking-requests/${requestId}`),
        ),
      );

      for (const response of responses) {
        expect(response.statusCode, response.body).toBe(200);
        expect(response.json().status).toBe('expired');
      }

      expect(await heldDateStatus(eventDate)).toBeNull();
    }
  });
});
