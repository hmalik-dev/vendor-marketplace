/**
 * Operator alerts (VEN-405): what pushes to the one person running the
 * platform, instead of waiting in an admin list for them to open it.
 */

/**
 * Every kind of operator email. The immediate kinds are deduplicated per
 * subject; `daily_digest` is claimed once per operator-local calendar date.
 *
 * `launch_switch_flipped` is raised by the launch switches (VEN-404), so an
 * accidental flip is noticed the same hour rather than when bookings dry up.
 */
export const OPERATOR_ALERT_KINDS = [
  'dispute_opened',
  'payout_failed',
  'refund_failed',
  'payment_refused',
  'stripe_webhook_failing',
  'vendor_payouts_disabled',
  'report_filed',
  'launch_switch_flipped',
  'daily_digest',
] as const;
export type OperatorAlertKind = (typeof OPERATOR_ALERT_KINDS)[number];

/** The kinds sent the moment they happen, as opposed to the morning digest. */
export type ImmediateOperatorAlertKind = Exclude<OperatorAlertKind, 'daily_digest'>;

/**
 * What became of a recorded alert.
 *
 * `logged` is a deployment with no `OPERATOR_ALERT_EMAIL` — development only,
 * because a deployment refuses to boot without one. `skipped` is a digest day
 * with nothing to report, recorded so the day is not re-examined every tick.
 */
export const OPERATOR_ALERT_OUTCOMES = ['sent', 'logged', 'skipped'] as const;
export type OperatorAlertOutcome = (typeof OPERATOR_ALERT_OUTCOMES)[number];

/** One email per kind and subject in this window, however often the event recurs. */
export const OPERATOR_ALERT_DEDUPE_MS = 6 * 60 * 60_000;

/** The operator-local hour from which the day's digest is due. */
export const OPERATOR_DIGEST_LOCAL_HOUR = 7;

/**
 * How often each instance asks whether the digest is due. The claim makes a
 * second instance's tick a no-op, so this bounds lateness, not correctness.
 */
export const OPERATOR_DIGEST_POLL_INTERVAL_MS = 5 * 60_000;

/** Stripe webhook failures (bad signature or a 5xx) that raise one alert… */
export const STRIPE_WEBHOOK_FAILURE_THRESHOLD = 3;
/** …when they fall inside this window. */
export const STRIPE_WEBHOOK_FAILURE_WINDOW_MS = 10 * 60_000;

/**
 * Failed transfer attempts on one booking before the operator is told.
 *
 * The sweep retries every quarter of an hour forever, so there is no literal
 * final retry. A first failure is usually a vendor finishing onboarding and
 * heals itself; three in a row is money a person has to look at.
 */
export const PAYOUT_FAILURE_ALERT_ATTEMPTS = 3;
