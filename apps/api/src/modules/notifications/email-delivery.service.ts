import type { EmailDeliveryOutcome } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { Clock } from '../../plugins/clock.js';
import type { ResendEvent } from '../webhooks/resend.schemas.js';
import { applyDeliveryEvent, type DeliveryEventOutcome } from './email-delivery.dao.js';

/**
 * What the handler did, in one word, for the log line and the response body.
 *
 * `ignored` is the service's own value rather than the DAO's: an event type
 * that changes no record never reaches the DAO at all. `unmatched` splits the
 * DAO's `unknown` in two — see `DELIVERY_EVENT_RETRY_WINDOW_MS`.
 */
export type ResendEventOutcome = Exclude<DeliveryEventOutcome, 'unknown'> | 'ignored' | 'unmatched';

/**
 * How long an event naming no record is treated as one that has **outrun its
 * row**, rather than one that was never ours.
 *
 * The two look identical and need opposite answers. The attempt row is written
 * after Resend accepts the message, so a delivery event can genuinely arrive
 * first — a slow insert behind a saturated pool, a redeploy in between — and
 * that one must be refused so Resend redelivers, or a real bounce is lost for
 * ever. But this platform also sends mail through the same Resend account that
 * this table deliberately does not record: `support.service.ts`'s report is
 * written *by* a visitor and read by us, so it has no recipient row to hang off
 * (see the `email_deliveries` schema). Every support submission therefore
 * produces a delivery event that can never match — and refusing those for
 * Resend's full multi-hour backoff would drive the endpoint's failure rate up
 * until the provider disables it, silently ending the bounce recording this
 * whole feature exists for.
 *
 * The window separates them, because the race is a matter of seconds and a
 * foreign event is unmatched for ever. Two minutes spans Resend's first couple
 * of retries, so a racing event is recovered on the redelivery that follows its
 * row, and a foreign one costs two refusals rather than a day of them.
 */
export const DELIVERY_EVENT_RETRY_WINDOW_MS = 2 * 60 * 1000;

/**
 * The events that change a record, and the outcome each writes.
 *
 * Taken from Resend's published catalogue rather than from the three that came
 * to mind, because a type omitted here falls through to `ignored` — and an
 * `ignored` failure leaves the row saying `sent` for a message the provider is
 * telling us never arrived, which is the exact false negative this table exists
 * to prevent.
 *
 * - `email.failed` — "the email failed to send due to an error".
 * - `email.suppressed` — Resend refused it outright, because the address is on
 *   the account's suppression list. Nothing was sent, so it is a `failed` too;
 *   the reason it is *not* a `bounced` is that no receiving server rejected
 *   anything, and conflating them would report a dead address that may be fine.
 *
 * Deliberately absent: `email.sent`, because the send path already wrote that
 * row and the event would only restate it; `email.delivery_delayed`, because a
 * delay is not an outcome — the message is still in flight and a `delivered` or
 * a `bounced` follows; `email.scheduled` and `email.received`, which this
 * product never produces; and `email.opened` / `email.clicked` on principle,
 * see `EMAIL_DELIVERY_OUTCOMES`.
 */
const EVENT_OUTCOMES: Readonly<Record<string, EmailDeliveryOutcome>> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'failed',
};

/**
 * The lookup, with the prototype chain out of scope.
 *
 * `EVENT_OUTCOMES[event.type]` on a plain object literal answers a `Function`
 * for `toString`, `constructor` and `valueOf` — which walks straight past an
 * `=== undefined` guard and puts a function where an enum value belongs, 500ing
 * the route and putting the provider into a retry loop instead of returning a
 * clean `ignored`. `type` is a free string on a signed payload, so the guard is
 * cheap insurance rather than a live exploit.
 */
function outcomeFor(type: string): EmailDeliveryOutcome | undefined {
  return Object.hasOwn(EVENT_OUTCOMES, type) ? EVENT_OUTCOMES[type] : undefined;
}

/** The events whose reason is worth storing. Only a bounce carries a diagnostic. */
const REASON_EVENTS: ReadonlySet<string> = new Set(['email.bounced']);

/** A part Resend actually sent. Absent and empty are both nothing to report. */
function isPresent(part: string | undefined): part is string {
  return part !== undefined && part.length > 0;
}

/**
 * Why a bounce bounced, assembled from the parts Resend sends.
 *
 * `message` is the receiving server's own diagnostic and is the useful half;
 * the classification is prepended because `Permanent/General` is what tells an
 * operator whether the address is dead or the mailbox was merely full, and a
 * message alone often does not say.
 */
function bounceReason(event: ResendEvent): string | null {
  const bounce = event.data.bounce;

  if (!bounce) {
    return null;
  }

  const classification = [bounce.type, bounce.subType].filter(isPresent).join('/');
  const parts = [classification, bounce.message].filter(isPresent);

  return parts.length > 0 ? parts.join(': ') : null;
}

/**
 * When the provider says the event happened.
 *
 * Its own timestamp rather than ours: Resend retries a failed delivery for
 * hours, so "when we processed it" and "when it happened" can be a working day
 * apart, and the record is meant to say the second.
 *
 * **The top-level `created_at`, not `data.created_at`** — and the two are easy
 * to swap, because both exist on every payload and both are ISO instants a few
 * hundred milliseconds apart in Resend's own example. The top level is when the
 * *event* was generated; `data` is the email resource, so its `created_at` is
 * when the **message** was created. Reading `data` first made
 * `outcome_updated_at` a copy of `sent_at` on every row: a bounce five hours
 * later would record as having happened at the moment of sending, and "when did
 * this address start failing" would be unanswerable from a column built to
 * answer it.
 *
 * `data.created_at` remains the fallback rather than being dropped — it is
 * closer to the truth than our own clock — and the clock is the last resort,
 * which keeps the column non-null and keeps the suites off the real clock.
 */
function occurredAt(event: ResendEvent, now: Clock): Date {
  for (const stated of [event.created_at, event.data.created_at]) {
    if (stated === undefined) {
      continue;
    }

    const parsed = new Date(stated);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return now();
}

/**
 * Applies one Resend delivery event to the attempt row it names.
 *
 * A **complaint carries no failure reason** — somebody pressed a button, and
 * there is no diagnostic to store — and a delivery carries none by definition.
 * Only a bounce has one, which is why `REASON_EVENTS` gates it rather than the
 * outcome: `email.failed` and `email.suppressed` share the `failed` outcome and
 * carry no `bounce` object at all.
 */
export async function applyResendDeliveryEvent(
  db: AppDatabase,
  event: ResendEvent,
  now: Clock,
): Promise<ResendEventOutcome> {
  const outcome = outcomeFor(event.type);

  if (outcome === undefined) {
    return 'ignored';
  }

  const happenedAt = occurredAt(event, now);

  const applied = await applyDeliveryEvent(db, {
    providerMessageId: event.data.email_id,
    outcome,
    failureReason: REASON_EVENTS.has(event.type) ? bounceReason(event) : null,
    occurredAt: happenedAt,
  });

  if (applied !== 'unknown') {
    return applied;
  }

  /*
   * No row, and the age decides which kind of "no row" it is. A negative age —
   * an event stamped in the future by clock skew — counts as recent, which errs
   * towards asking for the redelivery that can still succeed.
   */
  const age = now().getTime() - happenedAt.getTime();

  return age <= DELIVERY_EVENT_RETRY_WINDOW_MS ? 'unmatched' : 'ignored';
}
