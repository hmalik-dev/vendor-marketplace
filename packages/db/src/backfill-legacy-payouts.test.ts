import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingRequests, bookings } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The half of #423 that decides whether the platform pays every existing
 * vendor a second time.
 *
 * Migrations run in order against an empty database, so this one never meets a
 * legacy row there — the rows it exists for have to be recreated by hand,
 * which is the only way to learn whether it works before it meets a real one.
 *
 * What makes it load-bearing: `payout_released_at` defaults to null and the
 * payout sweep reads null as "this vendor has not been paid". Every booking
 * written before #423 was paid by a **destination charge**, so Stripe moved the
 * vendor's share at the instant the card succeeded. Skip the backfill and the
 * first sweep after deploy transfers all of it again, out of the platform's
 * balance, for every past booking at once — and nothing fails loudly, because a
 * nullable column left null is merely *worse* rather than invalid.
 */
const MIGRATION = path.join(MIGRATIONS_FOLDER, '0028_hold_payouts_until_the_event.sql');

const STATEMENTS = readFileSync(MIGRATION, 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

/** The backfill alone — the DDL ahead of it has already run by then. */
const BACKFILL = STATEMENTS.at(-1) as string;

const EVENT_DATE = '2026-03-14';
const PAID_ON = new Date('2026-01-08T15:30:00.000Z');

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

async function runBackfill(): Promise<void> {
  await testDb.db.execute(sql.raw(BACKFILL));
}

/**
 * A booking as the destination-charge path left it: paid, with no transfer
 * object of its own and nothing recording that the money had moved — because
 * under that model there was nothing to record.
 */
async function legacyBooking(
  status: 'confirmed' | 'completed' | 'cancelled',
  paidAt: Date | null,
): Promise<string> {
  const [request] = await testDb.db
    .insert(bookingRequests)
    .values({ customerId, vendorId, packageId, eventDate: EVENT_DATE, status: 'accepted' })
    .returning({ id: bookingRequests.id });

  const [row] = await testDb.db
    .insert(bookings)
    .values({
      requestId: request!.id,
      customerId,
      vendorId,
      eventDate: EVENT_DATE,
      totalAmountCents: 145_000,
      platformFeeCents: 17_400,
      vendorPayoutCents: 127_600,
      status,
      paidAt,
    })
    .returning({ id: bookings.id });

  return row!.id;
}

async function payoutOf(
  bookingId: string,
): Promise<{ releasedAt: Date | null; transferId: string | null }> {
  const rows = await testDb.db
    .select({
      releasedAt: bookings.payoutReleasedAt,
      transferId: bookings.stripeTransferId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId));

  return { releasedAt: rows[0]?.releasedAt ?? null, transferId: rows[0]?.transferId ?? null };
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'legacy-payouts'));
});

beforeEach(async () => {
  await testDb.db.delete(bookings);
  await testDb.db.delete(bookingRequests);
});

afterAll(async () => {
  await testDb.close();
});

describe('0028 backfill: bookings paid by a destination charge', () => {
  /*
   * `paid_at`, not `now()`. The money *was* released, and it was released when
   * the card succeeded — stamping today would claim the platform paid this
   * vendor months late.
   */
  it.each(['confirmed', 'completed'] as const)(
    'marks a %s booking released, at the moment it was paid',
    async (status) => {
      const bookingId = await legacyBooking(status, PAID_ON);

      expect((await payoutOf(bookingId)).releasedAt).toBeNull();

      await runBackfill();

      expect((await payoutOf(bookingId)).releasedAt?.toISOString()).toBe(PAID_ON.toISOString());
    },
  );

  /*
   * Left null on purpose: a destination charge has no transfer object, which is
   * exactly what `stripe_transfer_id`'s comment recorded for its whole life
   * until #423. The pair — released, no transfer — is what
   * `isLegacyDestinationPayout` reads afterwards to refuse a refund that would
   * have nothing to reverse.
   */
  it('leaves the transfer id null, because there was never a transfer', async () => {
    const bookingId = await legacyBooking('confirmed', PAID_ON);

    await runBackfill();

    expect((await payoutOf(bookingId)).transferId).toBeNull();
  });

  /*
   * A cancelled booking was refunded and its transfer reversed, so there is no
   * payout to mark. Claiming one would tell every later reader that this vendor
   * had been paid for a booking that did not happen.
   */
  it('leaves a cancelled booking alone', async () => {
    const bookingId = await legacyBooking('cancelled', PAID_ON);

    await runBackfill();

    expect((await payoutOf(bookingId)).releasedAt).toBeNull();
  });

  /*
   * `created_at` is the fallback for a row that somehow has no `paid_at`. The
   * column is nullable, and a released timestamp of null is the one value that
   * would put the row back in front of the sweep.
   */
  it('falls back to created_at when a row has no paid_at', async () => {
    const bookingId = await legacyBooking('confirmed', null);

    await runBackfill();

    expect((await payoutOf(bookingId)).releasedAt).not.toBeNull();
  });

  /*
   * Safe to run twice, which matters because a re-run is how a half-applied
   * migration is repaired — and because by then the sweep may have released a
   * *new* booking, whose real timestamp this must not overwrite.
   */
  it('does not touch a payout that has already been released', async () => {
    const bookingId = await legacyBooking('confirmed', PAID_ON);
    const releasedAt = new Date('2026-03-17T00:00:00.000Z');
    await testDb.db
      .update(bookings)
      .set({ payoutReleasedAt: releasedAt, stripeTransferId: 'tr_real' })
      .where(eq(bookings.id, bookingId));

    await runBackfill();

    expect((await payoutOf(bookingId)).releasedAt?.toISOString()).toBe(releasedAt.toISOString());
  });

  /* Guards the guard: a migration file that stopped parsing would pass everything. */
  it('reads the backfill out of the migration that ships', () => {
    expect(BACKFILL).toMatch(/UPDATE "bookings"/);
    expect(BACKFILL).toMatch(/payout_released_at/);
  });
});
