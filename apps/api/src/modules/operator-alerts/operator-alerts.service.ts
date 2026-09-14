import {
  BRAND_NAME,
  formatPrice,
  OPERATOR_ALERT_DEDUPE_MS,
  PAYOUT_FAILURE_ALERT_ATTEMPTS,
  STRIPE_WEBHOOK_FAILURE_THRESHOLD,
  STRIPE_WEBHOOK_FAILURE_WINDOW_MS,
  type ImmediateOperatorAlertKind,
} from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { BackgroundWork } from '../../lib/background.js';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { escapeHtml } from '../../lib/html-escape.js';
import type { Clock } from '../../plugins/clock.js';
import {
  findDisputeAlertSubject,
  findVendorAlertSubject,
  recordAlertUnlessRecent,
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
}

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
 * outcome must not depend on whether the operator's mail went out. A failed
 * send gives its dedupe row back, so the next occurrence tries again instead of
 * being silenced for six hours by an email nobody received.
 */
export async function alertNow(
  deps: OperatorAlertDeps,
  alert: OperatorAlert,
): Promise<AlertResult> {
  const now = deps.clock();
  const outcome = deps.to === undefined ? 'logged' : 'sent';

  let id: string | null;
  try {
    id = await recordAlertUnlessRecent(
      deps.db,
      { kind: alert.kind, subjectId: alert.subjectId, outcome, sentAt: now },
      new Date(now.getTime() - OPERATOR_ALERT_DEDUPE_MS),
    );
  } catch (error) {
    deps.log.error(
      { kind: alert.kind, subjectId: alert.subjectId, err: error },
      'Could not record an operator alert',
    );
    return 'failed';
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

  try {
    await deps.email.send({ to: deps.to, ...rendered, idempotencyKey: id });
    return 'sent';
  } catch (error) {
    deps.log.error(
      { kind: alert.kind, subjectId: alert.subjectId, err: error },
      'An operator alert could not be sent',
    );
    await releaseAlert(deps.db, id).catch((releaseError: unknown) => {
      deps.log.error(
        { kind: alert.kind, subjectId: alert.subjectId, err: releaseError },
        'Could not release the record of an unsent operator alert',
      );
    });
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

/** A refund that should have gone back to a customer did not. */
export function refundFailedAlert(input: { bookingId: string; during: string }): OperatorAlert {
  return {
    kind: 'refund_failed',
    subjectId: input.bookingId,
    summary: `Refund failed on booking ${input.bookingId}`,
    details: [
      `A refund attempted during ${input.during} did not go through; the customer's money has not moved.`,
      `Booking: ${input.bookingId}`,
    ],
    adminPath: '/admin/bookings',
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

/** The Stripe webhook keeps being refused or keeps failing. */
export function stripeWebhookFailingAlert(failures: number): OperatorAlert {
  const minutes = STRIPE_WEBHOOK_FAILURE_WINDOW_MS / 60_000;

  return {
    kind: 'stripe_webhook_failing',
    subjectId: 'stripe',
    summary: `Stripe webhook failed ${failures} times in ${minutes} minutes`,
    details: [
      `POST /webhooks/stripe answered a signature failure or a server error ${failures} times within ${minutes} minutes.`,
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
