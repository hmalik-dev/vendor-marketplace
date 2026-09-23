import { formatPrice, OPERATOR_DIGEST_LOCAL_HOUR } from '@vendor-marketplace/shared';
import {
  claimDigest,
  isDigestClaimed,
  readDigestFigures,
  releaseAlert,
  type DigestFigures,
  type MoneyTally,
} from './operator-alerts.dao.js';
import { renderOperatorEmail, type OperatorAlertDeps } from './operator-alerts.service.js';

export interface OperatorDigestDeps extends OperatorAlertDeps {
  /** `OPERATOR_TIMEZONE`, validated at boot by `operatorLocalTime`. */
  timeZone: string;
}

export type DigestResult = 'not-due' | 'already-claimed' | 'sent' | 'logged' | 'skipped' | 'failed';

const MS_PER_HOUR = 60 * 60_000;
/** The digest looks back one day and ahead two, per the ticket. */
const LOOKBACK_MS = 24 * MS_PER_HOUR;
const LOOKAHEAD_DAYS = 2;
/** More unpaid events than this are summarised by count; the console has the rest. */
const MAX_LISTED_UNPAID = 10;

/**
 * The operator's calendar date and hour at `now`.
 *
 * `Intl` rather than arithmetic on an offset, because the offset changes twice
 * a year. An unknown zone throws `RangeError`, which is what makes the plugin
 * refuse to boot on a mistyped `OPERATOR_TIMEZONE`.
 */
export function operatorLocalTime(now: Date, zone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')),
  };
}

/** `YYYY-MM-DD` plus whole days, on the calendar rather than the clock. */
function addCalendarDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function isDigestEmpty(figures: DigestFigures): boolean {
  const { openCases } = figures;

  return (
    figures.signups.every((row) => row.count === 0) &&
    figures.requests === 0 &&
    figures.payments.count === 0 &&
    figures.refunds.count === 0 &&
    figures.payouts.count === 0 &&
    openCases.underOneDay + openCases.oneToThreeDays + openCases.overThreeDays === 0 &&
    figures.bounces === 0 &&
    figures.unpaidSoon.length === 0
  );
}

function money(label: string, tally: MoneyTally): string {
  return `${label}: ${tally.count} totalling ${formatPrice(tally.totalCents)}`;
}

/** The digest's lines. Counts, totals and ids only — see `readDigestFigures`. */
export function composeDigestLines(figures: DigestFigures): string[] {
  const signups =
    figures.signups.length === 0
      ? 'none'
      : figures.signups.map((row) => `${row.count} ${row.role}`).join(', ');
  const { openCases } = figures;
  const unpaid = figures.unpaidSoon
    .slice(0, MAX_LISTED_UNPAID)
    .map((row) => `  Request ${row.requestId}, event ${row.eventDate}`);
  const unlisted = figures.unpaidSoon.length - unpaid.length;

  return [
    'Last 24 hours',
    `New sign-ups: ${signups}`,
    `Booking requests: ${figures.requests}`,
    money('Payments', figures.payments),
    money('Refunds', figures.refunds),
    money('Payouts released', figures.payouts),
    `Bounced emails: ${figures.bounces}`,
    'Open cases',
    `Under 1 day: ${openCases.underOneDay}; 1–3 days: ${openCases.oneToThreeDays}; over 3 days: ${openCases.overThreeDays}`,
    `Accepted but unpaid, event in the next 48 hours: ${figures.unpaidSoon.length}`,
    ...unpaid,
    ...(unlisted > 0 ? [`  …and ${unlisted} more`] : []),
  ];
}

/**
 * Sends the morning digest if it is due and no instance has sent it yet.
 *
 * **Safe on every instance at once.** Each one ticks; the claim row's partial
 * unique index lets exactly one insert win for the operator-local date, and
 * only the winner sends. A failed send gives the claim back so a later tick
 * retries. An empty day is claimed as `skipped` so it is not recomputed every
 * five minutes until midnight — and so a quiet morning that turns busy at noon
 * does not produce a "morning" digest at 12:05.
 */
export async function runOperatorDigest(
  deps: OperatorDigestDeps,
  now: Date,
): Promise<DigestResult> {
  const local = operatorLocalTime(now, deps.timeZone);

  if (local.hour < OPERATOR_DIGEST_LOCAL_HOUR) {
    return 'not-due';
  }

  if (await isDigestClaimed(deps.db, local.date)) {
    return 'already-claimed';
  }

  const figures = await readDigestFigures(deps.db, {
    since: new Date(now.getTime() - LOOKBACK_MS),
    until: now,
    fromDate: local.date,
    throughDate: addCalendarDays(local.date, LOOKAHEAD_DAYS),
  });

  const empty = isDigestEmpty(figures);
  const outcome = empty ? 'skipped' : deps.to === undefined ? 'logged' : 'sent';
  const claim = await claimDigest(deps.db, local.date, outcome, now);

  if (claim === null) {
    return 'already-claimed';
  }

  if (empty) {
    return 'skipped';
  }

  const summary = `Daily digest for ${local.date}`;
  const details = composeDigestLines(figures);

  if (deps.to === undefined) {
    deps.log.warn(
      { summary, details },
      'Operator digest (OPERATOR_ALERT_EMAIL is not set, so it was logged rather than sent)',
    );
    return 'logged';
  }

  try {
    await deps.email.send({
      to: deps.to,
      ...renderOperatorEmail({ summary, details, link: `${deps.webOrigin}/admin` }),
      idempotencyKey: claim,
      essential: true,
    });
    return 'sent';
  } catch (error) {
    deps.log.error({ date: local.date, err: error }, 'The operator digest could not be sent');
    await releaseAlert(deps.db, claim);
    return 'failed';
  }
}
