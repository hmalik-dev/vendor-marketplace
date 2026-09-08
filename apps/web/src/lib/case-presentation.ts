import {
  REPORT_REASON_LABELS,
  REPORT_SUBJECT_LABELS,
  SUPPORT_TOPIC_LABELS,
  type ReportReason,
  type ReportSubject,
  type SupportCaseOrigin,
  type SupportCaseStatus,
  type SupportTopic,
} from '@vendor-marketplace/shared';
import type { StatusTone } from '@/components/ui/status-pill';

/**
 * How the console words a case (#431).
 *
 * Written once because the queue and the case detail both say it, and two copies
 * of "what is this case about" is how the list and the screen it opens come to
 * disagree. The same shape as `BOOKING_PRESENTATION` in `booking-entries.ts`,
 * for the same reason and beside the same kind of table.
 */

/**
 * The subject line.
 *
 * A chargeback has **no topic** — nobody typed one — so the origin supplies the
 * word rather than a member being chosen on its behalf. The fallback past that
 * is `something-else`'s own label, which is what an unrecognised member would
 * have meant anyway.
 */
export function caseSubject(supportCase: {
  origin: SupportCaseOrigin;
  topic: SupportTopic | null;
  subjectType?: ReportSubject | null;
  reportReason?: ReportReason | null;
}): string {
  if (supportCase.origin === 'chargeback') {
    return 'Chargeback';
  }

  /*
   * An in-product report's topic is `trust-and-safety` by construction (#436),
   * so printing it would label every one of them identically. The reason and
   * the subject are what an operator triages on — "Harassment · Message
   * thread" — and both are on the row for exactly that.
   */
  if (supportCase.origin === 'user_report') {
    const reason = supportCase.reportReason ? REPORT_REASON_LABELS[supportCase.reportReason] : null;
    const subject = supportCase.subjectType ? REPORT_SUBJECT_LABELS[supportCase.subjectType] : null;

    return [reason, subject].filter((part) => part !== null).join(' · ') || 'Report';
  }

  return SUPPORT_TOPIC_LABELS[supportCase.topic ?? 'something-else'] ?? 'Support message';
}

/**
 * Which door the case came through, in the operator's words.
 *
 * A `Record` keyed by the enum rather than the ternary this replaced. That
 * ternary read `origin === 'chargeback' ? 'Stripe webhook' : 'Contact support'`
 * — a two-way branch on a three-member enum — so #436's in-product reports fell
 * through the else and told an operator they arrived by a door they did not,
 * on the one screen where somebody weighs how much the account of events is
 * worth. Keyed by the enum, a fourth origin is a type error here rather than a
 * wrong sentence on a case.
 */
export const CASE_ARRIVAL: Record<SupportCaseOrigin, string> = {
  support_message: 'Contact support',
  chargeback: 'Stripe webhook',
  user_report: 'Reported in the product',
};

/**
 * The pill.
 *
 * `40-states.md`'s colour law: **gold is waiting on someone** and **sage is
 * settled**, which is exactly what the two members mean — an open case is a
 * person waiting on the platform, and a resolved one is a ruling that has been
 * made.
 */
export const CASE_PRESENTATION: Record<SupportCaseStatus, { tone: StatusTone; label: string }> = {
  open: { tone: 'pending', label: 'Open' },
  resolved: { tone: 'confirmed', label: 'Resolved' },
};

/**
 * How long a case has been waiting, in whole days.
 *
 * The number the queue exists for, and it is computed rather than stored: the
 * age of the oldest open case is money somebody is not being paid, and a column
 * holding it would be wrong the moment nobody wrote to it. Whole days because
 * that is the granularity an operator acts on — nothing changes between "four
 * hours" and "seven hours", and everything changes at "eleven days".
 */
export function ageInDays(createdAt: Date, now: number): number {
  return Math.max(0, Math.floor((now - createdAt.getTime()) / 86_400_000));
}

/**
 * Age is the queue's pressure column, and its colour is the SLA rather than the
 * case.
 *
 * Drawn by Pattern A of the admin delta (#454): stone under 24h, gold at 24h,
 * red at 72h. Read it carefully — **red here means the SLA failed, not that the
 * case did**, which is why it does not contradict `40-states.md` reserving red
 * for failure. Somebody's payout has been frozen for three days.
 *
 * The thresholds land exactly on whole-day boundaries, so the figure and the
 * colour come from one number and cannot disagree: under 24h is `0d`, 24h and
 * 48h are `1d` and `2d`, and 72h is `3d`.
 *
 * Here rather than in the page for the reason the tables above it are: a page
 * file in the App Router is not a module you can import a helper out of, and an
 * age threshold nothing can unit-test is one nobody will notice going wrong.
 */
export function ageTone(days: number): string {
  if (days >= 3) {
    return 'text-error-500';
  }

  return days >= 1 ? 'text-gold-600' : 'text-stone-900';
}
