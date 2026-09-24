import { bookingRequests, bookings, categories, reviews } from '@vendor-marketplace/db/schema';
import { eq, sql, TransactionRollbackError } from 'drizzle-orm';
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
 * A second review of one booking landing while the first is still uncommitted —
 * on the driver production runs, because PGlite cannot tell this defect apart
 * from its fix.
 *
 * `createReview` reads for an existing review and then inserts; two
 * submissions both pass the read, and `reviews_booking_reviewer_key` is what
 * refuses the second. Its catch turned that refusal into a 409 through a helper
 * that read the driver's constraint field as `constraint` or `constraintName`.
 * postgres.js writes `constraint_name`, so the field never matched here, and
 * the only arm that fired was a substring of the error message — which Drizzle
 * builds with every bound parameter inlined.
 *
 * So the second case matters as much as the first: a review whose own text
 * carries the constraint's name, cancelled mid-statement, was answered "you have
 * already reviewed this booking" with nothing written and nothing logged.
 *
 * **Not two HTTP requests.** Whether both of those pass the read is a scheduling
 * accident, and a run where the second one sees the first commit answers 409
 * from the read and proves nothing about the catch. The first review is instead
 * an open transaction on a second connection, so the request is known to have
 * passed the read and to be blocked on the index before anything is decided.
 */
describe('a review racing another review of the same booking', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorId: string;
  let customerId: string;

  async function seedCompletedBooking(eventDate: string): Promise<string> {
    const db = harness!.database.db;

    const [request] = await db
      .insert(bookingRequests)
      .values({ customerId, vendorId, eventDate, status: 'accepted', finalPriceCents: 120_000 })
      .returning({ id: bookingRequests.id });

    const [booking] = await db
      .insert(bookings)
      .values({
        requestId: request!.id,
        customerId,
        vendorId,
        eventDate,
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'completed',
      })
      .returning({ id: bookings.id });

    return booking!.id;
  }

  /**
   * The customer's review of `bookingId`, inserted and held open until
   * `release` — committed or rolled back as asked.
   */
  function holdReview(bookingId: string, commit: boolean) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markInserted!: () => void;
    const inserted = new Promise<void>((resolve) => (markInserted = resolve));

    const settled = harness!.database.db
      .transaction(async (tx) => {
        await tx.insert(reviews).values({
          bookingId,
          reviewerId: customerId,
          vendorId,
          type: 'customer_to_vendor',
          rating: 4,
          content: 'The review that got there first, still uncommitted.',
        });
        markInserted();
        await released;

        if (!commit) {
          tx.rollback();
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof TransactionRollbackError)) {
          throw error;
        }
      });

    return { inserted, release, settled };
  }

  /** The backend of the one statement waiting on a lock in this database. */
  async function lockWaiter(): Promise<number> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const rows = await harness!.database.db.execute<{ pid: number }>(
        sql`select pid from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
      );

      if (rows.length === 1) {
        return rows[0]!.pid;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('The review request never blocked on the held review');
  }

  function submitReview(bookingId: string, content: string) {
    return harness!.app.inject({
      method: 'POST',
      url: `/v1/bookings/${bookingId}/reviews`,
      headers: bearer(CUSTOMER),
      payload: { rating: 5, content },
    });
  }

  async function reviewsOf(bookingId: string) {
    return harness!.database.db
      .select({ content: reviews.content })
      .from(reviews)
      .where(eq(reviews.bookingId, bookingId));
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
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

    await signInAs(harness, VENDOR);
    customerId = await signInAs(harness, CUSTOMER);

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
        businessName: 'Fernbank Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Fernbank Studio photographs weddings across central Texas.',
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);
    vendorId = profile.json().id;
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('answers the loser 409 when the first review commits', async () => {
    const bookingId = await seedCompletedBooking('2091-06-01');
    const held = holdReview(bookingId, true);
    await held.inserted;

    const response = submitReview(bookingId, 'A second review of the same wedding, sent twice.');

    try {
      await lockWaiter();
    } finally {
      // Released on failure too, or the open transaction stalls `afterAll`.
      held.release();
      await held.settled;
    }

    const answered = await response;
    expect(answered.statusCode).toBe(409);
    expect(answered.json().message).toBe('You have already reviewed this booking');
    expect(await reviewsOf(bookingId)).toEqual([
      { content: 'The review that got there first, still uncommitted.' },
    ]);
  });

  it('does not call a cancelled insert a duplicate because its text names the index', async () => {
    const bookingId = await seedCompletedBooking('2092-06-01');
    const held = holdReview(bookingId, false);
    await held.inserted;

    // Bound as a parameter, so Drizzle inlines it into the wrapper's message.
    const response = submitReview(
      bookingId,
      'Our planner signs every email reviews_booking_reviewer_key, which is a long story.',
    );
    let answered: Awaited<typeof response>;

    try {
      const pid = await lockWaiter();
      await harness!.database.db.execute(sql`select pg_cancel_backend(${pid})`);
      answered = await response;
    } finally {
      held.release();
      await held.settled;
    }

    /*
     * A cancelled statement is a fault, not a conflict: 503 (SQLSTATE 57014 is
     * how a statement timeout arrives too, VEN-607), logged, and the customer
     * free to try again. 409 would tell them a review exists that nobody wrote.
     */
    expect(answered.statusCode).toBe(503);
    expect(answered.json().error).toBe('SERVICE_BUSY');
    expect(await reviewsOf(bookingId)).toEqual([]);
  });
});
