import { emailDeliveries } from '@vendor-marketplace/db';
import type { NewEmailDeliveryRow } from '@vendor-marketplace/db';
import {
  EMAIL_DELIVERY_OUTCOMES,
  EMAIL_DELIVERY_OUTCOME_RANK,
  MAX_EMAIL_FAILURE_REASON_LENGTH,
  type EmailDeliveryOutcome,
} from '@vendor-marketplace/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../lib/database.js';

/**
 * For each outcome, the outcomes it may replace — everything it outranks.
 *
 * Derived from `EMAIL_DELIVERY_OUTCOME_RANK` rather than restated, so adding an
 * outcome to the shared constant cannot leave a hole here that silently reads
 * as "never supersedes". Computed once at module load, and it makes the guard
 * an ordinary `IN (…)` rather than a hand-built SQL `CASE` with a cast.
 */
const SUPERSEDABLE: Readonly<Record<EmailDeliveryOutcome, EmailDeliveryOutcome[]>> = Object.assign(
  // Null-prototype, so a lookup can never answer `Object.prototype.toString`
  // for an outcome that does not exist. The keys here are enum values rather
  // than free strings, but the table is indexed by one and the guard is free.
  Object.create(null) as Record<EmailDeliveryOutcome, EmailDeliveryOutcome[]>,
  Object.fromEntries(
    EMAIL_DELIVERY_OUTCOMES.map((incoming) => [
      incoming,
      EMAIL_DELIVERY_OUTCOMES.filter(
        (current) => EMAIL_DELIVERY_OUTCOME_RANK[current] < EMAIL_DELIVERY_OUTCOME_RANK[incoming],
      ),
    ]),
  ) as Record<EmailDeliveryOutcome, EmailDeliveryOutcome[]>,
);

/**
 * A provider diagnostic, cut to what the column holds.
 *
 * The string comes from Resend — an SMTP rejection quotes the receiving server
 * verbatim — so its length is somebody else's decision. Truncating rather than
 * letting Postgres refuse the row is deliberate: the whole point of this table
 * is that the record survives, and a `value too long` on a bounce would lose
 * exactly the row an operator came looking for.
 *
 * Applied here, in the DAO, on both write paths — so no caller has to remember
 * it and the two cannot disagree.
 */
function truncateFailureReason(reason: string | null | undefined): string | null {
  if (reason === null || reason === undefined) {
    return null;
  }

  if (reason.length <= MAX_EMAIL_FAILURE_REASON_LENGTH) {
    return reason;
  }

  /*
   * By code point, not by code unit. `slice` on a UTF-16 string can cut a
   * surrogate pair in half, and Postgres refuses the lone surrogate that
   * leaves — turning a too-long bounce into a `value too long` and then into
   * an encoding error, on the one write path that must not fail.
   */
  return Array.from(reason).slice(0, MAX_EMAIL_FAILURE_REASON_LENGTH).join('');
}

/**
 * Records one send attempt. One row per attempt — a retry is a second row.
 *
 * **Except a retry the provider deduplicated**, which is what
 * `onConflictDoNothing` is for. Resend answers a replayed `idempotency-key`
 * with the id of the message it already accepted, so a second send of one
 * notification row arrives here carrying the *same* `provider_message_id` —
 * and the partial unique index that makes the webhook's lookup unambiguous
 * would refuse it. Doing nothing is the honest outcome: the provider delivered
 * once, so there is one delivery, and the row already on the table describes
 * it. Raising instead would have been swallowed by the caller's best-effort
 * catch, losing nothing but logging a customer's address on the way past.
 */
export async function insertEmailDelivery(
  db: AppDatabase,
  values: NewEmailDeliveryRow,
): Promise<void> {
  await db
    .insert(emailDeliveries)
    .values({ ...values, failureReason: truncateFailureReason(values.failureReason) })
    .onConflictDoNothing({
      target: emailDeliveries.providerMessageId,
      // The partial index's own predicate, which a conflict target must repeat
      // for Postgres to recognise which index it means.
      where: sql`${emailDeliveries.providerMessageId} is not null`,
    });
}

/**
 * What a provider delivery event did to the record it names.
 *
 * `superseded` and `applied` are both successes and both answer the webhook
 * 200 — Resend must stop retrying either way. `unknown` is the third: an event
 * for a message this platform has no record of, which is what a replay after a
 * database restore, or a message sent from the same Resend account by
 * something else, looks like.
 */
export type DeliveryEventOutcome = 'applied' | 'superseded' | 'unknown';

export interface DeliveryEventInput {
  providerMessageId: string;
  outcome: EmailDeliveryOutcome;
  /** The provider's reason, on a bounce. Null otherwise. */
  failureReason: string | null;
  /** When the provider says the event happened. */
  occurredAt: Date;
}

/**
 * Applies one provider delivery event to the row it names, **only when it
 * outranks what that row already holds**.
 *
 * That single predicate is the whole of the idempotency requirement, and it is
 * a predicate on the `UPDATE` rather than a read followed by a write because
 * Resend retries: two deliveries of the same event can be in flight at once,
 * and a read-modify-write would let both pass their check before either wrote.
 * `email-delivery.contention.test.ts` holds it to that on a real server, since
 * PGlite's single connection cannot tell the guard from its absence.
 *
 * It also makes ordering irrelevant. Nothing promises a `delivered` arrives
 * before the `bounced` that follows it, and out of order the naive version
 * would leave the record saying the mail arrived when the address is dead.
 * Here the bounce stands, because `delivered` does not outrank it.
 */
export async function applyDeliveryEvent(
  db: AppDatabase,
  input: DeliveryEventInput,
): Promise<DeliveryEventOutcome> {
  const updated = await db
    .update(emailDeliveries)
    .set({
      outcome: input.outcome,
      failureReason: truncateFailureReason(input.failureReason),
      outcomeUpdatedAt: input.occurredAt,
    })
    .where(
      and(
        eq(emailDeliveries.providerMessageId, input.providerMessageId),
        inArray(emailDeliveries.outcome, SUPERSEDABLE[input.outcome]),
      ),
    )
    .returning({ id: emailDeliveries.id });

  if (updated.length > 0) {
    return 'applied';
  }

  /*
   * Nothing changed, and the two reasons need telling apart: a replay of an
   * event already applied is ordinary and says the system works, while an event
   * naming a message with no row is the signal that recording is broken or that
   * this endpoint is receiving somebody else's mail.
   *
   * A second round trip, and it is **not** the rare path — Resend retries, so
   * replays are routine. It is accepted rather than folded into the `UPDATE`
   * because both statements are equality probes on the same unique index, at
   * webhook volume, and the alternative is a hand-written CTE in a layer whose
   * whole job is to stay readable.
   */
  const [existing] = await db
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(eq(emailDeliveries.providerMessageId, input.providerMessageId))
    .limit(1);

  return existing ? 'superseded' : 'unknown';
}
