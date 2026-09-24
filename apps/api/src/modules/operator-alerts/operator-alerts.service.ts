import {
  BRAND_NAME,
  formatPrice,
  OPERATOR_ALERT_DEDUPE_MS,
  PAYOUT_FAILURE_ALERT_ATTEMPTS,
  STRIPE_WEBHOOK_FAILURE_THRESHOLD,
  STRIPE_WEBHOOK_FAILURE_WINDOW_MS,
  STRIPE_WEBHOOK_PERSISTED_FAILURE_WINDOW_MS,
  type ImmediateOperatorAlertKind,
  type StripeWebhookFailureKind,
} from '@vendor-marketplace/shared';
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { BackgroundWork } from '../../lib/background.js';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { EmailSendingClosedError } from '../../lib/email-send-cap.js';
import { escapeHtml } from '../../lib/html-escape.js';
import type { Clock } from '../../plugins/clock.js';
import {
  clearStripeWebhookFailures,
  findDisputeAlertSubject,
  findVendorAlertSubject,
  recordAlertUnlessRecent,
  recordStripeWebhookFailure,
  releaseAlert,
} from './operator-alerts.dao.js';

/**
 * Operator alerts (VEN-405): the events that need a person within hours, pushed
 * to one address instead of waiting in an admin list.
 *
 * **Never customer PII.** An alert carries ids, amounts, a vendor's business
 * name and an `/admin/...` link; the operator opens the console for the rest.
 * Every composer below is written to that rule, and a caller composing its own
 * alert (the launch switches, VEN-404) is held to it too.
 */
export interface OperatorAlert {
  kind: ImmediateOperatorAlertKind;
  /** Deduplication key within the kind — a case, booking or vendor id. */
  subjectId: string;
  /** One line; becomes the email subject. */
  summary: string;
  details: readonly string[];
  /** Console path the operator should open, e.g. `/admin/cases/<id>`. */
  adminPath: string | null;
}

export interface OperatorAlertDeps {
  db: AppDatabase;
  email: EmailGateway;
  log: FastifyBaseLogger;
  background: BackgroundWork;
  clock: Clock;
  /** `OPERATOR_ALERT_EMAIL`; absent only in development, where alerts are logged. */
  to: string | undefined;
  /** `canonicalWebOrigin(env)`, which every console link is built on. */
  webOrigin: string;
  /** Pauses between send retries; the suites pass one that resolves at once. */
  wait: (ms: number) => Promise<void>;
}

/** Waits before each retry of a failed alert send — two retries, then give up. */
export const OPERATOR_ALERT_RETRY_DELAYS_MS = [2_000, 10_000] as const;

/** When each alert last went out with no dedupe row behind it, per instance. */
const unrecordedSends = new Map<string, number>();

export type AlertResult = 'sent' | 'logged' | 'deduplicated' | 'failed';

export interface RenderedOperatorEmail {
  subject: string;
  html: string;
  text: string;
}

/** The one layout every operator email uses, the digest included. */
export function renderOperatorEmail(input: {
  summary: string;
  details: readonly string[];
  link: string | null;
}): RenderedOperatorEmail {
  const lines = input.link === null ? input.details : [...input.details, `Open: ${input.link}`];
  const htmlLines = input.details.map((line) => `<p>${escapeHtml(line)}</p>`);

  if (input.link !== null) {
    const href = escapeHtml(input.link);
    htmlLines.push(`<p><a href="${href}">${href}</a></p>`);
  }

  return {
    subject: `[${BRAND_NAME} ops] ${input.summary}`,
    text: [input.summary, '', ...lines].join('\n'),
    html: `<h1>${escapeHtml(input.summary)}</h1>${htmlLines.join('')}`,
  };
}

/**
 * Sends one alert now, unless the same kind and subject was alerted within
 * `OPERATOR_ALERT_DEDUPE_MS`.
 *
 * **Never throws.** Every caller is on a money or webhook path whose own
 * outcome must not depend on whether the operator's mail went out.
 *
 * **A failed send is retried here**, under the same idempotency key, because
 * most of these events never recur: a chargeback's redelivery answers
 * `already-recorded` and a report is filed once, so "the next occurrence" would
 * never come. Only when every attempt fails is the dedupe row given back — so a
 * recurring event (a payout the sweep keeps failing) can still alert later —
 * and the loss is logged at `error`. A process killed mid-retry loses the
 * alert; `background.drain` covers a graceful shutdown.
 */
export async function alertNow(
  deps: OperatorAlertDeps,
  alert: OperatorAlert,
): Promise<AlertResult> {
  const now = deps.clock();
  const outcome = deps.to === undefined ? 'logged' : 'sent';

  /*
   * The record is the dedupe and the audit trail, not a precondition for
   * telling a person. When it cannot be written — a database outage, which is
   * the likeliest cause of the incidents this watches for — the alert goes out
   * anyway under a fresh idempotency key: a duplicate email is the cheaper
   * mistake than a page that never happens (VEN-430). Duplicates are capped at
   * one per kind and subject per instance per dedupe window, so an outage an
   * anonymous flood rides cannot turn into a mailbomb.
   */
  let id: string | null;
  let recorded = true;
  try {
    id = await recordAlertUnlessRecent(
      deps.db,
      { kind: alert.kind, subjectId: alert.subjectId, outcome, sentAt: now },
      new Date(now.getTime() - OPERATOR_ALERT_DEDUPE_MS),
    );
  } catch (error) {
    deps.log.error(
      { kind: alert.kind, subjectId: alert.subjectId, err: error },
      'Could not record an operator alert; sending it unrecorded',
    );
    const key = `${alert.kind}:${alert.subjectId}`;
    const last = unrecordedSends.get(key);

    if (last !== undefined && now.getTime() - last < OPERATOR_ALERT_DEDUPE_MS) {
      return 'deduplicated';
    }

    unrecordedSends.set(key, now.getTime());
    id = randomUUID();
    recorded = false;
  }

  if (id === null) {
    return 'deduplicated';
  }

  const link = alert.adminPath === null ? null : `${deps.webOrigin}${alert.adminPath}`;

  if (deps.to === undefined) {
    deps.log.warn(
      { kind: alert.kind, subjectId: alert.subjectId, summary: alert.summary, link },
      'Operator alert (OPERATOR_ALERT_EMAIL is not set, so it was logged rather than sent)',
    );
    return 'logged';
  }

  const rendered = renderOperatorEmail({ summary: alert.summary, details: alert.details, link });

  for (const [attempt, delayMs] of OPERATOR_ALERT_RETRY_DELAYS_MS.entries()) {
    try {
      await deps.email.send({ to: deps.to, ...rendered, idempotencyKey: id, essential: true });
      return 'sent';
    } catch (error) {
      // A closed day refuses every retry too (VEN-661); waiting twelve seconds to hear it again helps nobody.
      if (error instanceof EmailSendingClosedError) {
        break;
      }

      deps.log.warn(
        { kind: alert.kind, subjectId: alert.subjectId, attempt: attempt + 1, err: error },
        'An operator alert send failed; retrying',
      );
      await deps.wait(delayMs);
    }
  }

  try {
    await deps.email.send({ to: deps.to, ...rendered, idempotencyKey: id, essential: true });
    return 'sent';
  } catch (error) {
    deps.log.error(
      { kind: alert.kind, subjectId: alert.subjectId, err: error },
      'An operator alert could not be sent after every retry',
    );
    if (recorded) {
      await releaseAlert(deps.db, id).catch((releaseError: unknown) => {
        deps.log.error(
          { kind: alert.kind, subjectId: alert.subjectId, err: releaseError },
          'Could not release the record of an unsent operator alert',
        );
      });
    }
    return 'failed';
  }
}

/** An alert, or a lookup that composes one (and may find nothing to say). */
export type AlertSource = OperatorAlert | (() => Promise<OperatorAlert | null>);

export interface OperatorAlerts {
  /** Sends and waits. For jobs with no request to answer. */
  alertNow(alert: OperatorAlert): Promise<AlertResult>;
  /**
   * Sends off the request path, through the same tracked background queue the
   * transactional email uses, so a shutdown drains it and a suite can await it.
   */
  dispatch(source: AlertSource): void;
}

export function createOperatorAlerts(deps: OperatorAlertDeps): OperatorAlerts {
  return {
    alertNow: (alert) => alertNow(deps, alert),
    dispatch(source) {
      deps.background.run(async () => {
        const alert = typeof source === 'function' ? await source() : source;

        if (alert !== null) {
          await alertNow(deps, alert);
        }
      });
    },
  };
}

// --- Composers ---------------------------------------------------------------

/** A chargeback opened a case. Null when the case cannot be found. */
export async function disputeOpenedAlert(
  db: AppDatabase,
  stripeDisputeId: string,
): Promise<OperatorAlert | null> {
  const subject = await findDisputeAlertSubject(db, stripeDisputeId);

  if (!subject) {
    return null;
  }

  return {
    kind: 'dispute_opened',
    subjectId: subject.caseId,
    summary: `Chargeback opened on booking ${subject.bookingId ?? '(none)'}`,
    details: [
      `A card network opened dispute ${stripeDisputeId}. The payout is held while it is open.`,
      `Booking: ${subject.bookingId ?? '(none)'}`,
      ...(subject.totalAmountCents === null
        ? []
        : [`Amount: ${formatPrice(subject.totalAmountCents)}`]),
      `Case: ${subject.reference} (${subject.caseId})`,
    ],
    adminPath: `/admin/cases/${subject.caseId}`,
  };
}

/**
 * A chargeback on a charge no booking here owns. Stripe has still debited the
 * disputed amount and fee from the platform balance and the evidence deadline
 * runs regardless, but there is no case to work from — so the operator is told
 * directly, by payment intent, and answers in the Stripe dashboard.
 *
 * Shares `dispute_opened`'s kind with its own `pi:` subject, so it dedupes
 * apart from a case-backed alert and needs no new enum member.
 */
export function unmatchedDisputeAlert(input: {
  disputeId: string;
  paymentIntentId: string;
  amountCents: number;
}): OperatorAlert {
  return {
    kind: 'dispute_opened',
    subjectId: `pi:${input.paymentIntentId}`,
    summary: `Chargeback on ${input.paymentIntentId} matches no booking`,
    details: [
      `A card network opened dispute ${input.disputeId} for ${formatPrice(input.amountCents)} on payment intent ${input.paymentIntentId}, which no booking here owns.`,
      'No case was opened and no payout was held. Stripe has debited the platform; check the Stripe dashboard before the evidence deadline.',
    ],
    adminPath: null,
  };
}

/**
 * A card issuer warned Stripe that a booking's charge looks fraudulent
 * (VEN-645). Nothing is frozen or refunded; a person rules on the case.
 */
export function earlyFraudWarningAlert(input: {
  caseId: string;
  reference: string;
  bookingId: string;
  fraudType: string;
}): OperatorAlert {
  return {
    kind: 'early_fraud_warning',
    subjectId: input.caseId,
    summary: `Early fraud warning on booking ${input.bookingId}`,
    details: [
      `The card issuer flagged the charge as "${input.fraudType}". A chargeback often follows within days.`,
      `Booking: ${input.bookingId}`,
      `Case: ${input.reference} (${input.caseId})`,
    ],
    adminPath: `/admin/cases/${input.caseId}`,
  };
}

/**
 * Stripe could not send a vendor's payout to their bank (VEN-645). Distinct from
 * `payoutFailedAlert`, which is this platform's own transfer to the vendor's
 * Stripe balance failing; here the money reached the vendor's account and the
 * bank refused it. Shares `payout_failed`'s kind with its own `po:` subject.
 */
export async function vendorBankPayoutFailedAlert(
  db: AppDatabase,
  stripeAccountId: string,
  payout: { payoutId: string; amountCents: number; failureMessage: string | null },
): Promise<OperatorAlert | null> {
  const vendor = await findVendorAlertSubject(db, stripeAccountId);

  if (!vendor) {
    return null;
  }

  return {
    kind: 'payout_failed',
    subjectId: `po:${payout.payoutId}`,
    summary: `${vendor.businessName}'s bank payout failed`,
    details: [
      `Stripe could not send ${formatPrice(payout.amountCents)} from connected account ${stripeAccountId} to the vendor's bank.`,
      `Stripe reason: ${payout.failureMessage ?? 'not given'}`,
      `Vendor: ${vendor.vendorId}`,
    ],
    adminPath: `/admin/users/${vendor.userId}`,
  };
}

/** Stripe moved a vendor who could be paid to one who cannot. */
export async function vendorPayoutsDisabledAlert(
  db: AppDatabase,
  stripeAccountId: string,
): Promise<OperatorAlert | null> {
  const vendor = await findVendorAlertSubject(db, stripeAccountId);

  if (!vendor) {
    return null;
  }

  return {
    kind: 'vendor_payouts_disabled',
    subjectId: vendor.vendorId,
    summary: `${vendor.businessName} can no longer be paid out`,
    details: [
      `Stripe disabled connected account ${stripeAccountId}; the payout sweep will fail for this vendor until it is fixed.`,
      `Vendor: ${vendor.vendorId}`,
      `Stripe reason: ${vendor.disabledReason ?? 'not given'}`,
    ],
    adminPath: `/admin/users/${vendor.userId}`,
  };
}

/**
 * A transfer failed on a booking that has now failed often enough to need a
 * person, or null while the sweep's own retries may still heal it.
 */
export function payoutFailedAlert(input: {
  bookingId: string;
  attempts: number;
  amountCents: number;
  reason: string;
}): OperatorAlert | null {
  if (input.attempts < PAYOUT_FAILURE_ALERT_ATTEMPTS) {
    return null;
  }

  return {
    kind: 'payout_failed',
    subjectId: input.bookingId,
    summary: `Payout failed ${input.attempts} times on booking ${input.bookingId}`,
    details: [
      `The vendor's ${formatPrice(input.amountCents)} transfer has failed ${input.attempts} attempts in a row.`,
      `Last failure: ${input.reason}`,
      `Booking: ${input.bookingId}`,
    ],
    adminPath: '/admin/payments',
  };
}

/**
 * The platform's Stripe balance is below what it still owes (VEN-644): money
 * waiting for vendors, or refundable to customers, has left it — paid out to
 * the bank, or spent on another booking's transfer. The next payout or refund
 * it cannot cover fails with `balance_insufficient`.
 */
export function platformBalanceShortAlert(input: {
  /** The UTC date checked, `YYYY-MM-DD`: one alert per day. */
  date: string;
  availableCents: number;
  pendingCents: number;
  unreleasedPayoutCents: number;
  refundableExposureCents: number;
}): OperatorAlert {
  const balanceCents = input.availableCents + input.pendingCents;
  const requiredCents = input.unreleasedPayoutCents + input.refundableExposureCents;

  return {
    kind: 'platform_balance_short',
    subjectId: input.date,
    summary: `The platform balance is ${formatPrice(requiredCents - balanceCents)} short of what it owes`,
    details: [
      `Stripe holds ${formatPrice(balanceCents)} (${formatPrice(input.availableCents)} available, ${formatPrice(input.pendingCents)} pending) against ${formatPrice(requiredCents)} still owed.`,
      `Owed: ${formatPrice(input.unreleasedPayoutCents)} in vendor payouts not yet sent, and ${formatPrice(input.refundableExposureCents)} more that bookings could still refund.`,
      'Confirm the platform payout schedule is manual, then find what left the balance — a payout, a refund or a dispute: docs/runbook-platform-balance.md.',
    ],
    adminPath: '/admin/payments',
  };
}

/**
 * A refund that should have gone back to a customer did not — or, with a
 * `refundId`, one that did go out but whose booking row could not be moved to
 * match (VEN-472), so the money and the row disagree.
 */
export function refundFailedAlert(input: {
  bookingId: string;
  during: string;
  refundId?: string;
}): OperatorAlert {
  const { bookingId, during, refundId } = input;

  return {
    kind: 'refund_failed',
    // Its own key: "the money did not move" must not silence "it moved and the row did not".
    subjectId: refundId ? `${bookingId}:unreconciled` : bookingId,
    summary: refundId
      ? `Refund sent but booking ${bookingId} could not be updated`
      : `Refund failed on booking ${bookingId}`,
    details: [
      refundId
        ? `A refund sent during ${during} went out, but the booking row changed underneath it and could not be cancelled. The customer is refunded; check whether the vendor was also paid.`
        : `A refund attempted during ${during} did not go through; the customer's money has not moved.`,
      `Booking: ${bookingId}`,
      ...(refundId ? [`Refund: ${refundId}`] : []),
    ],
    adminPath: '/admin/bookings',
  };
}

/**
 * Money was refunded at Stripe by someone other than the platform's own routes
 * (VEN-469) — the Dashboard or the API. Keyed on the booking and the total, so a
 * redelivered event and the payout claim finding the same refund send one email,
 * and a further refund on the same booking sends another.
 */
export function externalRefundAlert(input: {
  bookingId: string;
  externalCents: number;
  outcome: 'held' | 'recorded';
  payoutReleased: boolean;
}): OperatorAlert {
  return {
    kind: 'refund_unrecorded',
    subjectId: `${input.bookingId}:${input.externalCents}`,
    summary: `${formatPrice(input.externalCents)} refunded outside the app on booking ${input.bookingId}`,
    details: [
      `Stripe shows ${formatPrice(input.externalCents)} refunded on this booking's charge that the platform did not make.`,
      input.outcome === 'held'
        ? "The vendor's payout is on hold. Rule on it from the booking: uphold the refund or release the payout."
        : input.payoutReleased
          ? 'The payout had already been released, so nothing was held. Recovering it from the vendor is a decision for you.'
          : "The booking could not be put on hold in its current state, so the payout was not sent on this run. The next sweep will send it unless you hold the vendor's payouts from their page first.",
      `Booking: ${input.bookingId}`,
    ],
    adminPath: `/admin/bookings/${input.bookingId}`,
  };
}

/** Why a succeeded charge was given back rather than booked. */
export type RefusedPaymentCause = 'declined_request' | 'duplicate_intent' | 'vendor_unavailable';

/**
 * A refund Stripe later failed on a payment no booking owns — the refund of a
 * charge on a request the platform had already declined, which by design has no
 * booking row. The operator was told that refund was on its way, so this is the
 * correction, keyed on the payment intent.
 */
export function unmatchedRefundFailedAlert(input: {
  refundId: string;
  paymentIntentId: string;
  status: string;
  amountCents: number;
}): OperatorAlert {
  return {
    kind: 'refund_failed',
    subjectId: `pi:${input.paymentIntentId}`,
    summary: `Refund ${input.refundId} on ${input.paymentIntentId} ${input.status}`,
    details: [
      `Stripe marked the ${formatPrice(input.amountCents)} refund ${input.status} after accepting it; the customer's money has not moved.`,
      `Payment intent: ${input.paymentIntentId}`,
      'No booking owns this payment (a charge on a declined request). Refund it from the Stripe dashboard.',
    ],
    adminPath: '/admin/payments',
  };
}

const REFUSED_PAYMENT_WORDING: Record<
  RefusedPaymentCause,
  { subject: string; detail: (price: string) => string }
> = {
  declined_request: {
    subject: 'payment on a declined request',
    detail: (price) =>
      `A customer paid ${price} after the platform declined the request, so no booking was made.`,
  },
  duplicate_intent: {
    subject: 'second payment on a booked request',
    detail: (price) =>
      `A customer paid ${price} a second time on a request that was already booked, so the extra charge was not kept.`,
  },
  vendor_unavailable: {
    subject: "payment on a banned or closed vendor's request",
    detail: (price) =>
      `A customer paid ${price} on a request whose vendor was banned or closed, so no booking was made.`,
  },
};

/**
 * A charge succeeded on a request the platform had already refused, so it was
 * not booked, or a second charge landed on a request already booked.
 * `refunded` says whether the money is already on its way back; when it is
 * not, the webhook answers 500 and Stripe redelivers.
 */
export function paymentRefusedAlert(input: {
  requestId: string;
  paymentIntentId: string;
  amountCents: number;
  refunded: boolean;
  cause: RefusedPaymentCause;
}): OperatorAlert {
  const wording = REFUSED_PAYMENT_WORDING[input.cause];

  return {
    kind: 'payment_refused',
    /*
     * Two subjects, deduplicated apart: the failed refund is raised and then
     * redelivered into a success, and one shared key would let the first alert
     * swallow the second, leaving the operator told a charge is still unrefunded.
     */
    subjectId: `${input.requestId}:${input.refunded ? 'refunded' : 'unrefunded'}`,
    summary: input.refunded
      ? `Refunded a ${wording.subject} ${input.requestId}`
      : `A ${wording.subject} ${input.requestId} has not been refunded`,
    details: [
      wording.detail(formatPrice(input.amountCents)),
      input.refunded
        ? 'The payment has been refunded in full.'
        : 'The payment has not been refunded: the refund failed and Stripe will redeliver the event.',
      `Request: ${input.requestId}`,
      `Payment intent: ${input.paymentIntentId}`,
    ],
    adminPath: '/admin/payments',
  };
}

/**
 * An accepted request lapsed while Stripe could not settle its payment intent
 * (VEN-551): the hold reached its bound, so the request expired and the vendor's
 * date was freed. The intent is untouched and **not refunded** — a person looks
 * at it in Stripe and decides.
 */
export function expiryPaymentUnsettledAlert(input: {
  requestId: string;
  paymentIntentId: string;
  attempts: number;
}): OperatorAlert {
  return {
    kind: 'expiry_payment_unsettled',
    subjectId: input.requestId,
    summary: `Request ${input.requestId} expired with a payment intent Stripe would not settle`,
    details: [
      `The payment window closed and Stripe could not say whether the payment succeeded, or still reported it processing, for ${input.attempts} checks in a row. The request expired and the vendor's date is open again.`,
      'The payment intent has not been cancelled or refunded. If it succeeds later it is refunded by the usual path; check it in Stripe.',
      `Request: ${input.requestId}`,
      `Payment intent: ${input.paymentIntentId}`,
    ],
    adminPath: '/admin/payments',
  };
}

/** A signed-in account filed an in-product report. */
export function reportFiledAlert(input: {
  caseId: string;
  reference: string;
  subjectLabel: string;
  reasonLabel: string;
  vendorBusinessName: string;
}): OperatorAlert {
  return {
    kind: 'report_filed',
    subjectId: input.caseId,
    summary: `Report filed: ${input.reasonLabel}`,
    details: [
      `A ${input.subjectLabel.toLowerCase()} on ${input.vendorBusinessName}'s storefront was reported.`,
      `Reason: ${input.reasonLabel}`,
      `Case: ${input.reference} (${input.caseId})`,
    ],
    adminPath: `/admin/cases/${input.caseId}`,
  };
}

export type StripeWebhookFailure = StripeWebhookFailureKind;

const FAILURE_DESCRIPTIONS: Record<StripeWebhookFailure, { verb: string; described: string }> = {
  signature: { verb: 'refused', described: 'a signature failure' },
  'signature-missing': { verb: 'refused without a signature', described: 'a missing signature' },
  'server-error': { verb: 'failed', described: 'a server error' },
  'rate-limited': { verb: 'rate limited', described: 'a 429' },
};

/**
 * The Stripe webhook keeps being refused or keeps failing.
 *
 * Every failure kind is a **separate subject**, deduplicated apart. Anybody can
 * send an unsigned POST, so a burst of those is attacker-triggerable; sharing
 * one dedupe key would let three anonymous requests silence a real handler 5xx
 * outage, or a rotated signing secret, for six hours.
 */
export function stripeWebhookFailingAlert(
  failure: StripeWebhookFailure,
  failures: number,
  windowMs: number = STRIPE_WEBHOOK_FAILURE_WINDOW_MS,
): OperatorAlert {
  const span =
    windowMs >= 60 * 60_000 ? `${windowMs / 3_600_000} hours` : `${windowMs / 60_000} minutes`;
  const { verb, described } = FAILURE_DESCRIPTIONS[failure];

  return {
    kind: 'stripe_webhook_failing',
    subjectId: `stripe:${failure}`,
    summary: `Stripe webhook ${verb} ${failures} times in ${span}`,
    details: [
      `POST /webhooks/stripe answered ${described} ${failures} times within ${span}.`,
      'Payments, disputes and account updates may not be recorded. Check the API logs and the Stripe dashboard.',
    ],
    adminPath: null,
  };
}

/**
 * Counts failures in a sliding window and answers true once per threshold
 * crossing, then starts counting afresh.
 *
 * In-process by design: the webhook is served by the API's own instances and
 * the 6-hour dedupe row is what keeps several of them from each sending.
 */
export function createFailureWindow(clock: Clock): { record(): number | null } {
  let failures: number[] = [];

  return {
    record() {
      const now = clock().getTime();
      failures = [...failures.filter((at) => now - at < STRIPE_WEBHOOK_FAILURE_WINDOW_MS), now];

      if (failures.length < STRIPE_WEBHOOK_FAILURE_THRESHOLD) {
        return null;
      }

      const crossed = failures.length;
      failures = [];
      return crossed;
    },
  };
}

/**
 * The persisted counterpart of `createFailureWindow`: counts failures across
 * processes over `STRIPE_WEBHOOK_PERSISTED_FAILURE_WINDOW_MS`, so a single event
 * failing on every redelivery still crosses the threshold. Answers the count on
 * a crossing and null otherwise; a database that cannot be written answers null,
 * because the in-process window has already had its say.
 */
export async function recordPersistedWebhookFailure(
  db: AppDatabase,
  clock: Clock,
  failure: StripeWebhookFailure,
): Promise<number | null> {
  const now = clock();
  const total = await recordStripeWebhookFailure(
    db,
    failure,
    now,
    new Date(now.getTime() - STRIPE_WEBHOOK_PERSISTED_FAILURE_WINDOW_MS),
  );

  if (total < STRIPE_WEBHOOK_FAILURE_THRESHOLD) {
    return null;
  }

  await clearStripeWebhookFailures(db, failure);
  return total;
}
