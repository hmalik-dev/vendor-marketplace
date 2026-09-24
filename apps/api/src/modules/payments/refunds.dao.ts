import { and, eq, sql } from 'drizzle-orm';
import { bookings, refundAttempts, type BookingRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import type { FoundRefunds } from '../../lib/stripe.js';
import { applyBookingTransition } from './payments.dao.js';

/**
 * How many refunds under this scope Stripe has refused so far (VEN-469).
 *
 * The idempotency key is built from it, so every caller that reads the same
 * number sends the same key, and a recorded refusal moves the next attempt to a
 * new one.
 */
export async function readRefundAttempts(
  db: AppDatabase,
  paymentIntentId: string,
  scope: string,
): Promise<number> {
  const rows = await db
    .select({ failedAttempts: refundAttempts.failedAttempts })
    .from(refundAttempts)
    .where(
      and(eq(refundAttempts.paymentIntentId, paymentIntentId), eq(refundAttempts.scope, scope)),
    )
    .limit(1);

  return rows[0]?.failedAttempts ?? 0;
}

/**
 * Records that the refusal seen at `observed` attempts happened.
 *
 * A compare-and-set: two callers that were refused under the same key both call
 * this with the same `observed`, and exactly one increment lands. A plain
 * `+ 1` would skip a key for nothing, and a caller that arrives late would
 * move the key out from under one that is still using it.
 */
export async function recordRefundRefusal(
  db: AppDatabase,
  paymentIntentId: string,
  scope: string,
  observed: number,
): Promise<void> {
  await db
    .insert(refundAttempts)
    .values({ paymentIntentId, scope, failedAttempts: observed + 1 })
    .onConflictDoUpdate({
      target: [refundAttempts.paymentIntentId, refundAttempts.scope],
      set: { failedAttempts: observed + 1, updatedAt: sql`now()` },
      setWhere: eq(refundAttempts.failedAttempts, observed),
    });
}

/** What the booking row already accounts for, and what Stripe holds beyond it. */
type RefundLedgerRow = Pick<BookingRow, 'refundAmountCents' | 'externalRefundCents'>;

/**
 * Cents refunded at Stripe that this booking's row does not account for.
 *
 * The row accounts for the larger of two things: the total a cancellation
 * recorded (which already includes any refund found at Stripe and topped up,
 * VEN-477), and the platform's own refunds plus the foreign ones already
 * recorded here. Taking the larger rather than the sum is what stops a foreign
 * refund from being counted twice once a cancellation has folded it in.
 */
export function unrecordedRefundCents(row: RefundLedgerRow, found: FoundRefunds | null): number {
  if (!found) {
    return 0;
  }

  const accountedFor = Math.max(
    row.refundAmountCents ?? 0,
    found.platformCents + row.externalRefundCents,
  );

  return Math.max(0, found.amountCents - accountedFor);
}

export interface ExternalRefundFinding {
  /** `held` moved the booking to `disputed`; `recorded` only wrote the figure down. */
  outcome: 'held' | 'recorded';
  /** The foreign refunds in total, in cents. */
  externalCents: number;
  /** What was newly found on this call. */
  unrecordedCents: number;
  /** Why it could not be held, when it could not. */
  status: BookingRow['status'];
  payoutReleased: boolean;
}

/**
 * Writes down a refund made outside the platform and freezes the payout, in one
 * transaction (VEN-469). `null` when there is nothing new — a duplicate
 * delivery, or a refund that is our own.
 *
 * The row is re-read under its lock, so the comparison is made against what a
 * concurrent cancellation has just written and not against whatever the caller
 * read before the Stripe round trip. The hold is the existing one, `status =
 * 'disputed'` through `applyBookingTransition`, and it is taken only where the
 * payout can still be stopped: a released payout and a cancelled booking are
 * recorded, and the caller tells the admin (a clawback is VEN-381's ruling).
 */
export async function recordExternalRefund(
  db: AppDatabase,
  bookingId: string,
  found: FoundRefunds,
  reason: (externalCents: number) => string,
): Promise<ExternalRefundFinding | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update');

    if (!row) {
      return null;
    }

    const unrecordedCents = unrecordedRefundCents(row, found);

    if (unrecordedCents === 0) {
      return null;
    }

    /*
     * From what is unaccounted for, not from the marker: a refund the platform
     * made before the marker existed carries none, and subtracting only marked
     * refunds would call it foreign.
     */
    const externalCents = row.externalRefundCents + unrecordedCents;

    await tx
      .update(bookings)
      .set({ externalRefundCents: externalCents })
      .where(eq(bookings.id, bookingId));

    /*
     * Our own refund exists at Stripe and the row has not recorded one: a
     * cancellation or unwind is between sending it and writing the row. It read
     * Stripe before or after this foreign refund and folds whatever it found
     * into the total it writes, so holding the booking here would fail its
     * guarded update (`status = confirmed`) after the money moved. The figure is
     * recorded either way, and `payoutResidualHeld` reads it once the booking is
     * cancelled. A cancellation that dies here is finished by its retry, which
     * finds both refunds; until then the cents are protected only once the row is
     * `cancelled`, and a confirmed row whose cancellation never lands is the
     * pre-existing window the platform refund alone already opens (VEN-499).
     */
    const ownRefundInFlight = found.platformCents > 0 && row.refundAmountCents === null;
    const holdable =
      (row.status === 'confirmed' || row.status === 'completed') &&
      row.payoutReleasedAt === null &&
      !ownRefundInFlight;
    const held = holdable
      ? await applyBookingTransition(
          tx,
          bookingId,
          row.status,
          { status: 'disputed', disputeReason: reason(externalCents) },
          null,
        )
      : null;

    return {
      outcome: held ? 'held' : 'recorded',
      externalCents,
      unrecordedCents,
      status: row.status,
      payoutReleased: row.payoutReleasedAt !== null,
    };
  });
}

/**
 * Gives back the foreign refunds that did not land (VEN-499).
 *
 * `externalRefundCents` only ever grew, so a Dashboard refund that later failed
 * or was canceled kept the residual payout held until an admin ruled. What
 * is still foreign is what Stripe reports usable beyond our own marked refunds;
 * the recorded figure is lowered to that and never raised, so a delivery for
 * our own refund, or a duplicate, changes nothing.
 *
 * Stripe is read **under the row lock**, like `recordExternalRefund` re-reads
 * the row: a figure read before the lock could erase a foreign refund a
 * concurrent `charge.refunded` recorded in between. Returns the cents released.
 */
export async function releaseFailedExternalRefunds(
  db: AppDatabase,
  bookingId: string,
  readRefunds: () => Promise<FoundRefunds | null>,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ externalRefundCents: bookings.externalRefundCents })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for('update');

    if (!row || row.externalRefundCents === 0) {
      return 0;
    }

    const found = await readRefunds();
    const stillForeign = found ? Math.max(0, found.amountCents - found.platformCents) : 0;

    if (row.externalRefundCents <= stillForeign) {
      return 0;
    }

    await tx
      .update(bookings)
      .set({ externalRefundCents: stillForeign })
      .where(eq(bookings.id, bookingId));

    return row.externalRefundCents - stillForeign;
  });
}
