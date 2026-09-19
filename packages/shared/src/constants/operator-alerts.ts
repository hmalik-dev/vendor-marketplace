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

/** Stripe webhook failures (bad signature, a 5xx or a 429) that raise one alert… */
export const STRIPE_WEBHOOK_FAILURE_THRESHOLD = 3;
/** …when they fall inside this window. */
export const STRIPE_WEBHOOK_FAILURE_WINDOW_MS = 10 * 60_000;
/**
 * The same threshold over a persisted, longer window (VEN-430).
 *
 * Stripe's redelivery backoff spaces the retries of one failing event minutes to
 * hours apart, so the ten-minute in-process window never sees three of them. A
 * steadily failing event therefore alerts on its third delivery, and no later
 * than this after the first failure — provided the failures keep arriving.
 */
export const STRIPE_WEBHOOK_PERSISTED_FAILURE_WINDOW_MS = 24 * 60 * 60_000;

/**
 * What a refused or failed webhook request counts as. `signature-missing` is
 * the header absent altogether (a scanner), kept apart from `signature` (a
 * header that does not verify — a rotated secret) so junk traffic cannot use up
 * the dedupe window a real credential break needs.
 */
export const STRIPE_WEBHOOK_FAILURE_KINDS = [
  'signature',
  'signature-missing',
  'server-error',
  'rate-limited',
] as const;
export type StripeWebhookFailureKind = (typeof STRIPE_WEBHOOK_FAILURE_KINDS)[number];

/**
 * Failed transfer attempts on one booking before the operator is told.
 *
 * The sweep retries every quarter of an hour forever, so there is no literal
 * final retry. A first failure is usually a vendor finishing onboarding and
 * heals itself; three in a row is money a person has to look at.
 */
export const PAYOUT_FAILURE_ALERT_ATTEMPTS = 3;
