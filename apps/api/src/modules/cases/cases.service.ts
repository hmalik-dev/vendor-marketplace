import {
  addDays,
  formatPrice,
  pageWindow,
  payoutStatusOf,
  REPORT_CASE_TOPIC,
  REPORTED_THREAD_WINDOW_DAYS,
  toDateString,
  type AdminCaseBooking,
  type AdminCaseDetail,
  type AdminCasePage,
  type AdminCaseQuery,
  type AdminConversationMessages,
  type AdminConversationWindow,
  type ReportReason,
  type ReportSubject,
  type SupportTopic,
} from '@vendor-marketplace/shared';
import { withRequestIdentity } from '@vendor-marketplace/db';
import type { BookingRow, SupportCaseRow } from '@vendor-marketplace/db/schema';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import { isForeignEnvPaymentIntent, type StripeDisputeSnapshot } from '../../lib/stripe.js';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import { fullName } from '../admin/admin.service.js';
import {
  earlyFraudWarningAlert,
  unmatchedDisputeAlert,
  type AdminAlerts,
} from '../admin-alerts/admin-alerts.service.js';
import {
  AlreadyHeldError,
  announceDisputeHold,
  disputeHoldAudience,
  placeDisputeHold,
  settleLostChargeback,
  StaleBookingError,
  type BookingContext,
} from '../payments/payments.service.js';
import { countMessages, findMessages, type MessageWindow } from '../messaging/messaging.dao.js';
import { findConversationParties } from '../reports/reports.dao.js';
import {
  countCaseWidenings,
  countSupportCases,
  findBookingForDispute,
  findCaseBooking,
  findCaseByStripeDisputeId,
  insertFraudWarningCase,
  findCaseResolutionState,
  findOpenCaseForConversation,
  findOpenChargebackCase,
  findSupportCaseById,
  findSupportCases,
  insertSupportCase,
  markCaseEmailFailed,
  markCaseResolved,
  recordNetworkOutcome,
  type CaseBookingProjection,
  type DisputedBookingProjection,
  type SupportCaseProjection,
} from './cases.dao.js';
import { DISPUTE_RESOLVABLE_OUTCOMES } from '../payments/payouts.dao.js';

/**
 * The operations case queue (#431) — one inbox for every dispute, however it
 * arrived.
 *
 * **What this module is not.** It moves no money. `placeDisputeHold` and
 * `resolveDispute` in `payments.service.ts` are the primitives, and a chargeback
 * reaches the first of them through the same call a customer's report does. The
 * ticket's rule, kept: never a second money path.
 *
 * **The legacy, stated rather than left silent** (`.claude/rules/db-schema.md`).
 * Support messages sent before this table existed wrote no row and cannot be
 * backfilled — they were never stored anywhere but two inboxes, which is what
 * `support.service.ts` said in words. Bookings already sitting in `disputed`
 * likewise have no case. Both are visible where they always were: the reason is
 * on the booking and `/admin/bookings?status=disputed` still lists them, and
 * resolving one through the existing route works exactly as before. There is
 * nothing to migrate because there is nothing to migrate from.
 */

export interface CaseDeps {
  db: AppDatabase;
  log: FastifyBaseLogger;
}

/**
 * What went wrong, with **nothing the caller wrote**.
 *
 * A failed statement in drizzle arrives as a `DrizzleQueryError`, whose
 * `message` is `Failed query: <sql>\nparams: <every bound parameter>` and which
 * carries `query` and `params` as own enumerable properties. pino's `err`
 * serialiser copies own properties, and `server.ts`'s redaction is path-based on
 * `req.headers.*` — so handing that error to the logger writes the support
 * message body and the sender's address into the log stream.
 *
 * That is not a hypothetical. The statement this module fails on binds up to
 * 4,000 characters somebody typed into a public, unauthenticated form, and a
 * caller can *choose* to fail it: `freeText()` strips bidi controls and trims,
 * neither of which removes `U+0000`, and Postgres refuses a null byte with
 * `22021`. Six sends an hour, each writing a chosen 4 KB and a chosen address
 * into the log.
 *
 * So the driver's code is what is logged, and never the error. It is the half
 * that says what to fix — a constraint name, `23505`, `22021` — and it is the
 * same rule `support.service.ts` states forty lines below its own send failure:
 * *"the reference and the failure, never the address."*
 */
function describeFailure(error: unknown): { name: string; code: string | null } {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;

  return {
    name: error instanceof Error ? error.name : 'unknown',
    code: typeof cause?.code === 'string' ? cause.code : null,
  };
}

/**
 * A best-effort write, and never one that undoes the work it records.
 *
 * The same rule `bestEffortNotice` carries in payments and in the admin service
 * (#408): best-effort if and only if the operation has already committed an
 * irreversible effect. Its own copy here rather than an import, because both of
 * those take a module context this module does not have and threading one
 * through would be a larger coupling than a four-line body — the shape is the
 * rule, and the rule is stated at each of the three.
 *
 * **It logs `describeFailure`, not `err`, and that is load-bearing** rather than
 * a stylistic difference from the other two: every write this module makes binds
 * content a stranger typed, and the two existing copies bind ids. See above.
 */
async function bestEffort<T>(
  log: FastifyBaseLogger,
  subject: Record<string, string>,
  work: () => Promise<T>,
  message: string,
): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    log.error({ ...subject, failure: describeFailure(error) }, message);

    return null;
  }
}

// --- What the support route writes -----------------------------------------

export interface OpenSupportCaseInput {
  reference: string;
  topic: SupportTopic;
  message: string;
  senderUserId: string | null;
  senderEmail: string;
  bookingId: string | null;
}

/**
 * The record beside the email, **never instead of it**.
 *
 * Best-effort by the rule above, and this is the case that most needs it: by the
 * time this runs the payout hold has been placed, and a throw here would answer
 * 502 on a report the customer has to re-send — which the hold would then refuse
 * as a duplicate, leaving them told they have already reported a booking they
 * have no record of reporting. Losing the row costs the admin a queue entry;
 * losing the send costs the customer their complaint and freezes a vendor's
 * money behind nothing.
 *
 * Returns the case where one was written, so the caller can record a failed send
 * against it.
 */
export async function openSupportCase(
  deps: CaseDeps,
  input: OpenSupportCaseInput,
): Promise<SupportCaseRow | null> {
  return bestEffort(
    deps.log,
    { reference: input.reference },
    () =>
      insertSupportCase(deps.db, {
        reference: input.reference,
        origin: 'support_message',
        topic: input.topic,
        message: input.message,
        senderUserId: input.senderUserId,
        senderEmail: input.senderEmail,
        bookingId: input.bookingId,
      }),
    'A support message was sent but its case row could not be written',
  );
}

export interface OpenReportCaseInput {
  reference: string;
  message: string;
  senderUserId: string;
  senderEmail: string;
  subjectType: ReportSubject;
  subjectId: string;
  reason: ReportReason;
}

/**
 * The third door: a report raised from inside the product (#436).
 *
 * Best-effort by the same rule as `openSupportCase`, and the rule holds for the
 * same reason — the caller has already sent, or is about to send, the email
 * that is the actual delivery, and a row that could not be written must not
 * cost it. What is different is what it does *not* do: no hold is placed
 * anywhere on this path, so there is no frozen payout for a failed row to
 * strand, and no vendor notice that would be announcing a freeze that never
 * happened.
 *
 * `topic` is filled in with `REPORT_CASE_TOPIC` rather than left null. A
 * chargeback's topic is null because nobody typed one; a report's is known by
 * construction, and filling it is what puts these cases in front of an admin
 * filtering the queue for trust and safety.
 */
export async function openReportCase(
  deps: CaseDeps,
  input: OpenReportCaseInput,
): Promise<SupportCaseRow | null> {
  return bestEffort(
    deps.log,
    { reference: input.reference },
    () =>
      insertSupportCase(deps.db, {
        reference: input.reference,
        origin: 'user_report',
        topic: REPORT_CASE_TOPIC,
        message: input.message,
        senderUserId: input.senderUserId,
        senderEmail: input.senderEmail,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        reportReason: input.reason,
      }),
    'A report was filed but its case row could not be written',
  );
}

/**
 * Marks the case as one nobody received.
 *
 * Best-effort for the same reason and one step further along: the caller is
 * already raising the 502 the send failed with, and replacing that with this
 * one would tell the customer their message was fine and something else broke.
 */
export async function recordCaseSendFailure(
  deps: CaseDeps,
  supportCase: SupportCaseRow,
  now: Date,
): Promise<void> {
  await bestEffort(
    deps.log,
    { reference: supportCase.reference },
    () => markCaseEmailFailed(deps.db, supportCase.id, now),
    'A support message failed to send and its case could not record the failure',
  );
}

/**
 * True when this booking's payout is frozen by a chargeback rather than by the
 * customer's own report — the one case where a second report must still be
 * delivered. See `findOpenChargebackCase`.
 */
export async function heldByChargeback(deps: CaseDeps, bookingId: string): Promise<boolean> {
  return (await findOpenChargebackCase(deps.db, bookingId)) !== null;
}

// --- What the Stripe webhook writes ----------------------------------------

/** What the handler did, for the webhook's response body and its log line. */
export type ChargebackOutcome =
  | 'dispute-opened'
  | 'dispute-recorded'
  | 'already-recorded'
  /** The event is signed and valid, and about a charge this platform did not make. */
  | 'ignored';

export interface ChargebackDeps extends CaseDeps {
  /** The payments module's context, so the hold is placed by its own primitive. */
  bookings: BookingContext;
  /** Told of a dispute that matches no booking; absent in a suite that does not care. */
  alerts?: AdminAlerts;
  /** `DEPLOY_ENV`: a dispute on another deployment's charge is not this admin's to hear of. */
  deployEnv: string;
}

/**
 * Closed disputes that moved no money, so there is nothing to freeze. `lost`
 * and `charge_refunded` are deliberately absent: the platform was debited, so
 * they still go through the hold and a payout is not released on top of them.
 */
const CLOSED_DISPUTE_STATUSES: ReadonlySet<string> = new Set(['won', 'warning_closed']);

/** What an open dispute's status says about the money: `lost`, an inquiry as itself, else nothing yet. */
function openOutcome(status: string): string | null {
  return status === 'lost' || status.startsWith('warning_') ? status : null;
}

/**
 * The sentence the admin reads. Composed here, from figures Stripe answered
 * with — never a field a payload could have carried arbitrary text in.
 */
function chargebackMessage(dispute: StripeDisputeSnapshot): string {
  return (
    `The card network opened a chargeback for ${formatPrice(dispute.amountCents)}. ` +
    `Stripe gives the reason as "${dispute.reason}" and the dispute id as ${dispute.id}. ` +
    'Nobody typed this message; it is the platform recording a network event.'
  );
}

/** What a chargeback's hold attempt came to: who was frozen, or why not. */
interface HoldResult {
  held: Pick<BookingRow, 'id' | 'vendorId'> | null;
  holdRefusal: string | null;
}

/**
 * Why the chargeback's hold was not needed, in the platform's own words.
 *
 * Reached only when `placeDisputeHold` has refused, and only for the refusals
 * that are facts about this booking's money rather than advice for a customer.
 * Each one leaves an admin with a different job, which is why they are three
 * sentences and not one.
 */
function describeHoldRefusal(target: DisputedBookingProjection): string {
  if (target.payoutReleasedAt) {
    return (
      'The payout had already been released when this chargeback arrived, so there was ' +
      'nothing left to freeze. If the network rules against the platform, the vendor owes it back ' +
      'and it is kept from their next payouts.'
    );
  }

  if (target.bookingStatus === 'disputed') {
    return (
      'The payout was already on hold when this chargeback arrived, so this case did not ' +
      'place it. It is frozen either way — the booking below says so.'
    );
  }

  if (
    target.bookingStatus === 'cancelled' &&
    target.payoutModel === 'separate' &&
    target.vendorPayoutCents > 0
  ) {
    return (
      "The booking is cancelled, so the payout was not frozen, but the vendor's remaining share " +
      "is held by this case. It is released only once the card network rules in the platform's favour."
    );
  }

  return `The payout could not be frozen: the booking is ${target.bookingStatus}.`;
}

/**
 * A chargeback arrives, opens a case, and freezes the payout (#431).
 *
 * **The hold goes through `placeDisputeHold` and nothing else.** A chargeback is
 * the customer disputing the charge at their bank, so the hold is placed as
 * them — which is what makes this an orchestrator of the existing primitive
 * rather than the second writer the ticket forbids.
 *
 * **A refused hold does not refuse the case.** `placeDisputeHold` turns away a
 * booking whose payout has already been released and one whose event has not
 * happened yet; both are right for a customer's own report and neither is
 * something a card network's decision can be turned away by. So the refusal is
 * caught and recorded on the case, and the admin sees why the money is not
 * frozen instead of seeing nothing. Letting it throw would also have made the
 * webhook 500 and Stripe retry the same refusal for three days.
 *
 * Idempotent twice over: the read below covers an ordinary replay, and
 * `insertSupportCase`'s conflict clause covers two deliveries at once. Neither
 * can double-hold — `placeDisputeHold` refuses a booking that is already
 * `disputed`, and that refusal is one of the ones recorded rather than raised.
 */
export async function openChargebackCase(
  deps: ChargebackDeps,
  disputeId: string,
  /**
   * The read from Stripe, deferred (#431).
   *
   * A thunk rather than the snapshot, because the first thing this does is ask
   * whether the chargeback is already in the queue — and Stripe replays
   * `charge.dispute.created` on any non-2xx and on ordinary at-least-once
   * delivery. Taking the snapshot as a parameter meant every replay paid a full
   * outbound Stripe round trip, on the webhook's hot path, to discover it had
   * nothing to do.
   */
  retrieve: () => Promise<StripeDisputeSnapshot>,
  reference: string,
  now: Date,
): Promise<ChargebackOutcome> {
  const existing = await findCaseByStripeDisputeId(deps.db, disputeId);

  if (existing) {
    /* A settlement that failed after the case was written is finished by the redelivery (VEN-645). */
    if (existing.networkOutcome === 'lost' && existing.bookingId) {
      await settleLostChargeback(
        deps.bookings,
        existing.bookingId,
        (await retrieve()).amountCents,
        now,
      );
    }

    return 'already-recorded';
  }

  const dispute = await retrieve();

  if (!dispute.paymentIntentId) {
    return 'ignored';
  }

  /*
   * Before the lookup, not inside its miss (VEN-529): a staging database
   * branched from production holds production's payment intent ids, so the
   * other deployment's chargeback would match a copied booking here.
   */
  if (
    await isForeignEnvPaymentIntent(deps.bookings.stripe, dispute.paymentIntentId, deps.deployEnv)
  ) {
    deps.log.info(
      { disputeId, paymentIntentId: dispute.paymentIntentId },
      'Ignored a dispute on a payment intent created by another deployment',
    );
    return 'ignored';
  }

  const target = await findBookingForDispute(deps.db, dispute.paymentIntentId);

  /*
   * A dispute on a charge with no booking behind it — a Dashboard test
   * payment, another product on the same Stripe account. Acknowledged rather
   * than refused, for the reason the intent handler beside it gives: a 4xx
   * makes Stripe retry for three days and count the endpoint as failing, for
   * an event that could never be applied. But Stripe has still debited the
   * platform and the evidence deadline still runs, so the admin is told
   * (VEN-430): with no case and no email it would pass by default.
   */
  if (!target) {
    deps.alerts?.dispatch(
      unmatchedDisputeAlert({
        disputeId,
        paymentIntentId: dispute.paymentIntentId,
        amountCents: dispute.amountCents,
      }),
    );
    return 'ignored';
  }

  /*
   * A dispute Stripe already closed is recorded, never held. `created` is
   * redelivered after a failure, so it can land after a `closed` that matched
   * no case and was answered `already-recorded` — placing the hold now would
   * freeze a vendor's payout for a dispute that is over. The case still opens,
   * carrying the outcome that close would have written, so the admin sees it.
   */
  if (CLOSED_DISPUTE_STATUSES.has(dispute.status)) {
    const recorded = await insertSupportCase(deps.db, {
      reference,
      origin: 'chargeback',
      message: chargebackMessage(dispute),
      senderUserId: target.customerId,
      bookingId: target.bookingId,
      stripeDisputeId: dispute.id,
      holdRefusal:
        'Stripe reported this dispute already closed when the platform first heard of it, ' +
        'so no hold was placed on the payout.',
      networkOutcome: dispute.status,
    });

    return recorded ? 'dispute-recorded' : 'already-recorded';
  }

  /*
   * Composed once and used twice — as the hold's reason and as the case's
   * message — because the two are required to be the same sentence. Two calls
   * made that a coincidence rather than a guarantee.
   */
  const message = chargebackMessage(dispute);

  const outcome = await placeDisputeHold(
    deps.bookings,
    {
      id: target.customerId,
      authUserId: target.customerAuthUserId,
      role: target.customerRole,
    },
    target.bookingId,
    message,
    now,
    /*
     * The whole reason this parameter exists. A chargeback on an event three
     * months out is exactly when the hold matters most — the money is still at
     * the platform — and `placeDisputeHold`'s before-the-event refusal is advice
     * for a customer, not a rule a card network can be turned away by. Without
     * it the sweep pays the vendor on the event date with the chargeback live.
     */
    'network',
  ).then(
    (held): HoldResult => ({ held, holdRefusal: null }),
    async (error: unknown): Promise<HoldResult> => {
      /*
       * **Only the 409s, and not the retryable one.**
       *
       * `placeDisputeHold`'s 409s are facts about the booking that will still be
       * true in a minute — the event has not happened, the payout has gone, the
       * status cannot be disputed — so they are what an admin needs written on
       * the case. `StaleBookingError` is the exception the primitive now names:
       * it means only that the row moved between the read and the write, and
       * filing that as a settled refusal behind a 200 would tell Stripe never to
       * retry a request that would probably have worked.
       *
       * Everything else — a 403, a 404, a lost connection — is a real failure and
       * is thrown. Catching the base class would have filed a case claiming a
       * hold that a retry could still have placed, and would have quoted copy
       * written for a customer's report form back at an admin.
       */
      if (
        error instanceof StaleBookingError ||
        !(error instanceof AppError) ||
        error.statusCode !== 409
      ) {
        throw error;
      }

      /*
       * **The admin's sentence, composed from the row.** Not
       * `error.message`: `placeDisputeHold`'s refusals are second-person copy
       * written for the customer's report form, and the worst of them —
       * *"You have already reported a problem with this booking"* — would tell
       * an admin that the payout is loose while the booking card beside it
       * says `On hold`. That is a contradiction on the screen where somebody
       * decides who keeps the money.
       *
       * Read off the row rather than matched on the prose, for the reason
       * `StaleBookingError` exists: the copy will be edited and this would not
       * follow it.
       */
      /*
       * **Whose hold is it?** `AlreadyHeldError` from a concurrent delivery of
       * this very dispute, or from an earlier delivery that placed the hold and
       * then failed before its case was written, means *this* case did place
       * it — the hold's reason is this dispute's message, and a customer's
       * report cannot carry it. `target` was read before either, so it is read
       * again: it may still say `confirmed`.
       */
      if (error instanceof AlreadyHeldError) {
        const current = (await findBookingForDispute(deps.db, dispute.paymentIntentId!)) ?? target;

        return current.disputeReason === message
          ? { held: { id: current.bookingId, vendorId: current.vendorId }, holdRefusal: null }
          : { held: null, holdRefusal: describeHoldRefusal(current) };
      }

      return { held: null, holdRefusal: describeHoldRefusal(target) };
    },
  );

  const { held, holdRefusal } = outcome;

  /*
   * **The vendor is told, exactly as a customer's report tells them.**
   *
   * `sendSupportMessage` announces its hold and this did not, so a vendor whose
   * payout a chargeback froze saw `On hold` appear on their dashboard with no
   * notification and no explanation. The two doors were supposed to be one
   * queue; a notice through one of them and silence through the other is the
   * asymmetry this ticket set out to remove.
   *
   * Only when a hold was actually placed — announcing a freeze that did not
   * happen is the mistake in the other direction — and best-effort inside
   * `announceDisputeHold` itself, because a bell that did not ring must not undo
   * money that did move.
   *
   * **The lookup is before the case is written and the bell after.** A lookup
   * that throws 5xxs the webhook and the redelivery finds the hold already
   * placed by this dispute (above), so it still gets here — whereas a bell rung
   * before the write rings once per delivery that reaches it, and two concurrent
   * deliveries both do. Ringing only for the delivery whose insert wins is
   * exactly once.
   */
  const audience = held ? await disputeHoldAudience(deps.bookings, held) : null;

  const written = await insertSupportCase(deps.db, {
    reference,
    origin: 'chargeback',
    message,
    /* The customer is who disputed it, even though they typed nothing here. */
    senderUserId: target.customerId,
    bookingId: target.bookingId,
    stripeDisputeId: dispute.id,
    holdRefusal,
    /*
     * A `lost` that closed while this delivery was failing and being retried
     * matched no case and was dropped; `retrieve` is the only place left that
     * still knows it. An inquiry (`warning_*`) is recorded as itself, because
     * Stripe debits nothing for one and the balance check counts it apart from
     * a chargeback. Every other open status means the dispute is still with the
     * network, which is what `null` says.
     */
    networkOutcome: openOutcome(dispute.status),
  });

  if (written && audience) {
    await announceDisputeHold(deps.bookings, audience, 'network');
  }

  /*
   * Whether or not this delivery wrote the case: a delivery that wrote it and
   * then failed here is redelivered into `already-recorded`, and the settlement
   * is idempotent.
   */
  if (dispute.status === 'lost') {
    await settleLostChargeback(deps.bookings, target.bookingId, dispute.amountCents, now);
  }

  return written ? 'dispute-opened' : 'already-recorded';
}

/**
 * The network closed it, and that is **all** this records.
 *
 * Stripe's outcome and the platform's disposition are different facts: winning a
 * chargeback does not decide whether the vendor was in the right, and losing one
 * does not decide that they were not. The case stays `open` until an admin
 * rules on it. Auto-resolving here would settle a dispute on a card network's
 * evidence rules.
 *
 * A close for a dispute we never opened a case for answers `already-recorded`
 * rather than opening one now: the `created` event is what places the hold, and
 * a case opened at close time would be a hold nobody placed on money already
 * gone.
 */
export async function recordChargebackOutcome(
  deps: Pick<ChargebackDeps, 'db' | 'log' | 'bookings'>,
  dispute: StripeDisputeSnapshot,
  now: Date,
): Promise<ChargebackOutcome> {
  const updated = await recordNetworkOutcome(deps.db, dispute.id, dispute.status, now);

  /*
   * A `lost` ruling is the one outcome that ends the booking's money (VEN-645):
   * the customer is already whole and the platform has been debited. Every other
   * outcome is recorded and left to an admin, as above. Idempotent, so a
   * redelivered close settles nothing twice.
   */
  if (updated?.bookingId && dispute.status === 'lost') {
    await settleLostChargeback(deps.bookings, updated.bookingId, dispute.amountCents, now);
  }

  return updated ? 'dispute-recorded' : 'already-recorded';
}

// --- What the console reads ------------------------------------------------

/**
 * The sender's name, or `null` where there is no account behind the case.
 *
 * `fullName` is the admin service's, exported for this: the console prints the
 * same three names on this screen that `/admin/bookings` prints on its own, and
 * a private copy is how the two come to print one person differently.
 */
function senderName(row: SupportCaseProjection): string | null {
  if (!row.senderUserId) {
    return null;
  }

  return fullName(row.senderFirstName ?? '', row.senderLastName ?? '') || null;
}

function toCaseRow(row: SupportCaseProjection) {
  return {
    id: row.id,
    reference: row.reference,
    origin: row.origin,
    status: row.status,
    topic: row.topic,
    senderUserId: row.senderUserId,
    senderName: senderName(row),
    senderEmail: row.senderEmail,
    bookingId: row.bookingId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    reportReason: row.reportReason,
    createdAt: row.createdAt,
  };
}

export async function listCases(db: AppDatabase, query: AdminCaseQuery): Promise<AdminCasePage> {
  /*
   * `pageWindow`, not the arithmetic. Its own docstring says it exists because
   * "#408 closed four reads that had none at all and the arithmetic is exactly
   * the sort that gets written out a fifth time with the `- 1` missing" — and on
   * this queue a skipped row is a payout nobody is looking at.
   */
  const { limit, offset } = pageWindow(query);
  const [rows, total] = await Promise.all([
    findSupportCases(db, query, limit, offset),
    countSupportCases(db, query),
  ]);

  /*
   * The counted ways out, and **only** for an empty page (#454).
   *
   * Pattern A's filtered-empty offers one widening per filter, each carrying
   * the rows it would reveal, so an admin picks the widening that pays
   * rather than clearing everything and rebuilding the query. The count has to
   * exist before the button is drawn — a route revealing zero is never
   * offered — which is why it rides home with the list rather than being
   * fetched per button.
   *
   * Sequential rather than folded into the `Promise.all` above: it costs an
   * unfiltered scan and the overwhelming majority of requests to this route
   * return rows, where that scan buys nothing at all.
   *
   * **Page one only, and that is a correctness condition rather than a saving.**
   * `rows.length === 0` is also true for every page past the last one, where
   * the filter is revealing plenty — so without it `?page=2` on a queue holding
   * four open cases renders "No open cases", which is false, above a count of
   * rows the admin can already see on page one.
   */
  const widenings =
    rows.length === 0 && query.page === 1 ? await countCaseWidenings(db, query) : [];

  return {
    items: rows.map(toCaseRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    widenings,
  };
}

/** One case, with the booking's money beside it. */
export async function readCase(db: AppDatabase, caseId: string): Promise<AdminCaseDetail> {
  const found = await findSupportCaseById(db, caseId);

  if (!found) {
    throw notFound('That case does not exist');
  }

  const booking = found.bookingId ? await findCaseBooking(db, found.bookingId) : null;

  return {
    ...toCaseRow(found),
    message: found.message,
    holdRefusal: found.holdRefusal,
    emailFailedAt: found.emailFailedAt,
    networkOutcome: found.networkOutcome,
    stripeDisputeId: found.stripeDisputeId,
    resolvedByName: found.resolvedAt
      ? fullName(found.resolvedFirstName ?? '', found.resolvedLastName ?? '') || null
      : null,
    resolvedAt: found.resolvedAt,
    booking: booking ? toCaseBooking(booking) : null,
  };
}

/**
 * The booking as the case renders it.
 *
 * A destructure-rest rather than fifteen hand-copied fields, so the two lines
 * that actually *do* something — the joined name and the derived payout state —
 * are the only ones written out. The hand-copied version dropped a field
 * silently whenever the projection and the schema grew one together, which is
 * the failure mode a list of assignments has and this shape does not.
 */
function toCaseBooking(booking: CaseBookingProjection): AdminCaseBooking {
  const { customerFirstName, customerLastName, ...rest } = booking;

  return {
    ...rest,
    customerName: fullName(customerFirstName, customerLastName),
    /*
     * `payoutStatusOf` rather than a fourth derivation of "what is held": #423
     * wrote that one for exactly this question and `booking-report.ts` and
     * `dashboard.service.ts` already read it. Copies of this predicate are how
     * the surfaces come to disagree about whether a vendor has been paid.
     */
    payoutStatus: payoutStatusOf(booking),
  };
}

/**
 * An admin closes a case that has no money riding on it.
 *
 * **It refuses a case whose booking is still `disputed`**, and that refusal is
 * the whole reason this is a separate control from the two-position one. Closing
 * a case while the payout it froze stays frozen is precisely the state this
 * ticket exists to end: a hold with no complaint an admin can find. The
 * dispute route lifts the hold *and* closes the case, so there is a right way to
 * do it and this says which.
 *
 * A second admin pressing the same button gets 409 rather than overwriting
 * the first one's name on the row — `markCaseResolved` matches on `open`.
 */
export async function resolveCase(
  deps: CaseDeps,
  actorId: string,
  caseId: string,
  now: Date,
): Promise<AdminCaseDetail> {
  /*
   * One query for the whole pre-check. It used to be `findSupportCaseById` plus
   * `findCaseBooking` — four joins and twenty-odd columns — to establish three
   * facts, two of which are booleans and the third one enum.
   */
  const state = await findCaseResolutionState(deps.db, caseId);

  if (!state) {
    throw notFound('That case does not exist');
  }

  if (state.bookingStatus === 'disputed') {
    throw conflict(
      'This case holds a payout. Resolve it for the vendor or the customer instead, ' +
        'so the money moves with the ruling.',
    );
  }

  /*
   * A cancelled booking is never `disputed`, so its chargeback case is the only
   * thing holding the vendor's residual (`payoutResidualHeld`). Closing it lifts
   * that hold, which pays the vendor while the network may have taken the money
   * back — the same rule `resolveDispute` applies to a vendor-favour ruling. An
   * allowlist, so an outcome Stripe adds later fails closed.
   */
  if (
    state.caseStatus === 'open' &&
    state.origin === 'chargeback' &&
    state.bookingStatus === 'cancelled' &&
    state.payoutModel === 'separate' &&
    !state.payoutReleasedAt &&
    (state.vendorPayoutCents ?? 0) > 0 &&
    !DISPUTE_RESOLVABLE_OUTCOMES.includes(state.networkOutcome ?? '')
  ) {
    throw conflict(
      state.networkOutcome === 'lost'
        ? "The card network ruled against the platform and has already taken this payment back, so the vendor's remaining share cannot be paid out as well."
        : "This case holds the vendor's remaining share while the chargeback is with the card network. Close it once the network has ruled in the platform's favour.",
    );
  }

  /*
   * **The audit row rides the transaction**, and that is the rule rather than a
   * preference (`recordAdminActionBestEffort`'s own docstring): best-effort if
   * and only if the operation has already committed an irreversible effect
   * outside Postgres. This one has not — it is a single `UPDATE` — so a failed
   * log write must roll the close back rather than leave a case closed with no
   * record of who closed it. An admin simply presses the button again.
   */
  const closed = await deps.db.transaction(async (tx) => {
    const row = await markCaseResolved(tx, caseId, actorId, now);

    if (!row) {
      return null;
    }

    await insertAdminAction(tx, {
      actorId,
      action: 'support_case_resolved',
      subjectType: 'support_case',
      subjectId: caseId,
      /*
       * The reference and the shape of the case, never its message. The audit
       * log records what changed and not the content of what was moderated —
       * a log that quotes the complaint is a second copy of the complaint.
       */
      detail: { reference: row.reference, origin: row.origin, hadBooking: row.bookingId !== null },
    });

    return row;
  });

  if (!closed) {
    throw conflict('That case has already been resolved');
  }

  return readCase(deps.db, caseId);
}

// --- What the console reads under a case's authority -----------------------

/**
 * The dates a case lets an admin read of the thread it reports (VEN-412).
 *
 * A booking dates the case, so the read is its **event date** — Pattern C's
 * `12 Sep only`. A report names no event, so the read is the **week ending on
 * the day it was filed**: the messages that prompted it, and not the
 * relationship's whole history. Whole UTC days either way, because every stamp
 * in the thread is printed in UTC and a window drawn in another zone would cut
 * a day the chip says is included.
 *
 * Returns the inclusive calendar days the response states and the half-open
 * instants the query filters on, from one computation so they cannot disagree.
 */
export function reportedThreadWindow(grant: { createdAt: Date; eventDate: string | null }): {
  window: AdminConversationWindow;
  bounds: MessageWindow;
} {
  if (grant.eventDate !== null) {
    const from = new Date(`${grant.eventDate}T00:00:00.000Z`);

    return {
      window: { basis: 'event_date', from: grant.eventDate, to: grant.eventDate },
      bounds: { from, until: addDays(from, 1) },
    };
  }

  const filed = toDateString(grant.createdAt);
  const until = addDays(new Date(`${filed}T00:00:00.000Z`), 1);
  const from = addDays(until, -REPORTED_THREAD_WINDOW_DAYS);

  return {
    window: { basis: 'report_filed', from: toDateString(from), to: filed },
    bounds: { from, until },
  };
}

/**
 * The messages on a reported thread, read **only from the case that names it**
 * and **never without a row saying who read it** (#436).
 *
 * Four constraints, and each one is an acceptance rather than a nicety.
 *
 * 1. **Scoped, not a browse.** The grant is one row that is the case *and*
 *    names the conversation — `findOpenCaseForConversation` — so a caller
 *    holding a case id cannot pair it with a conversation id of their choosing.
 *    No open case, no read; and a
 *    **resolved** case is not a grant either, or every report ever filed would
 *    leave a permanent key to that thread behind it.
 * 2. **Logged, and the log is not best-effort.** `recordAdminActionBestEffort`
 *    exists for operations that have already committed something irreversible
 *    outside Postgres. A read has committed nothing, so the action row rides the
 *    same transaction as the select: a read that could not be logged did not
 *    happen, and the admin simply asks again. Logging afterwards, or
 *    swallowing the failure, is how the console comes to have read messages it
 *    has no record of reading — which is the entire reason #434 was this
 *    ticket's prerequisite.
 * 3. **Dated, not the whole history.** The grant also bounds *which* messages:
 *    `reportedThreadWindow` narrows the read to the case's event date, or to the
 *    week before the report, and the response names that window (VEN-412).
 * 4. **Read only.** There is no counterpart that writes into a thread, and there
 *    is not meant to be: the admin reads, then acts through moderation or
 *    through support. A message from the platform inside a private conversation
 *    would make the marketplace a party to it.
 */
export async function readCaseConversation(
  deps: CaseDeps,
  actorId: string,
  conversationId: string,
  caseId: string,
  page: number,
  pageSize: number,
): Promise<AdminConversationMessages> {
  const grant = await findOpenCaseForConversation(deps.db, caseId, conversationId);

  if (!grant) {
    throw forbidden(
      'No open case of this id names this conversation. Threads are readable from the report that ' +
        'raised them, and only while that case is open.',
    );
  }

  const parties = await findConversationParties(deps.db, conversationId);

  if (!parties) {
    /*
     * A case can outlive its subject — `subject_id` carries no foreign key on
     * purpose — so the grant existing does not prove the thread still does.
     */
    throw notFound('That conversation no longer exists');
  }

  const customerName = fullName(parties.customerFirstName, parties.customerLastName);
  const { window, bounds } = reportedThreadWindow(grant);

  const { rows, total } = await deps.db.transaction(async (tx) => {
    await insertAdminAction(tx, {
      actorId,
      action: 'conversation_messages_read',
      subjectType: 'conversation',
      subjectId: conversationId,
      /*
       * The case it was read under and how much of the thread was pulled —
       * never a line of what was said. The audit log records what happened and
       * not the content of what was moderated, which is what the table's own
       * doc comment calls the difference between a log and a second copy.
       */
      detail: {
        caseId: grant.id,
        reference: grant.reference,
        windowBasis: window.basis,
        windowFrom: window.from,
        windowTo: window.to,
        page,
        pageSize,
      },
    });

    // The audit row stays in this transaction; the thread is read under the admin's identity.
    const [found, counted] = await withRequestIdentity(
      tx,
      { userId: actorId, role: 'admin', admin: true },
      (scoped) =>
        Promise.all([
          findMessages(scoped, conversationId, pageSize, (page - 1) * pageSize, bounds),
          countMessages(scoped, conversationId, bounds),
        ]),
    );

    return { rows: found, total: counted };
  });

  return {
    conversationId,
    caseId: grant.id,
    caseReference: grant.reference,
    customerName,
    vendorName: parties.vendorBusinessName,
    window,
    messages: {
      items: rows.map((row) => ({
        id: row.id,
        senderId: row.senderId,
        senderName: row.senderId === parties.customerId ? customerName : parties.vendorBusinessName,
        senderSide:
          row.senderId === parties.customerId ? ('customer' as const) : ('vendor' as const),
        content: row.content,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      total,
      page,
      pageSize,
    },
  };
}

/** What the early fraud warning handler did, for the webhook's response body. */
export type FraudWarningOutcome = 'fraud-warning-opened' | 'fraud-warning-recorded' | 'ignored';

/**
 * A card issuer's early fraud warning opens a case and tells the admin
 * (VEN-645).
 *
 * **Nothing is refunded and nothing is frozen** (D46): an early fraud warning is
 * a signal, not a ruling. Auto-refunding on it would refund real customers whose
 * charge the issuer merely flagged, and would forfeit the vendor's booking with
 * no one having looked. The admin decides on the case, and a chargeback that
 * follows takes the hold path above.
 *
 * One case per booking: Stripe redelivers, and a second warning on the same
 * charge adds nothing an admin has not been told.
 */
export async function openFraudWarningCase(
  deps: Pick<ChargebackDeps, 'db' | 'log' | 'bookings' | 'alerts' | 'deployEnv'>,
  warning: { warningId: string; fraudType: string; paymentIntentId: string },
  reference: string,
): Promise<FraudWarningOutcome> {
  if (
    await isForeignEnvPaymentIntent(deps.bookings.stripe, warning.paymentIntentId, deps.deployEnv)
  ) {
    return 'ignored';
  }

  const target = await findBookingForDispute(deps.db, warning.paymentIntentId);

  if (!target) {
    deps.log.warn(
      { warningId: warning.warningId, paymentIntentId: warning.paymentIntentId },
      'Ignored an early fraud warning on a charge no booking here owns',
    );
    return 'ignored';
  }

  const written = await insertFraudWarningCase(deps.db, {
    reference,
    origin: 'fraud_warning',
    message:
      `A card issuer warned Stripe that this charge may be fraudulent ("${warning.fraudType}", warning ${warning.warningId}). ` +
      'Nothing was refunded or frozen. Nobody typed this message; it is the platform recording a network event.',
    senderUserId: target.customerId,
    bookingId: target.bookingId,
  });

  if (!written) {
    return 'fraud-warning-recorded';
  }

  deps.alerts?.dispatch(
    earlyFraudWarningAlert({
      caseId: written.id,
      reference,
      bookingId: target.bookingId,
      fraudType: warning.fraudType,
    }),
  );

  return 'fraud-warning-opened';
}
