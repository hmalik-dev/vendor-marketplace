import { randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  REPORT_REASON_LABELS,
  REPORT_SUBJECT_LABELS,
  type CreateReportInput,
  type ReportReceipt,
} from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { AppError, notFound, unauthorized } from '../../lib/errors.js';
import { openReportCase, recordCaseSendFailure } from '../cases/cases.service.js';
import { findUserEmail } from '../notifications/notification-email.dao.js';
import { renderReportNotice } from '../support/support-email.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import { findReportSubject, type ReportSubjectProjection } from './reports.dao.js';

/**
 * In-product reporting (#436) — the third door onto the case queue #431 built.
 *
 * **A report is not a second inbox.** It writes a `support_cases` row with
 * `origin = 'user_report'`, lands in `/admin/cases` beside the typed support
 * messages and the card networks' chargebacks, and is worked with the same two
 * controls. An operator working three queues works none of them.
 *
 * **And it moves no money.** The other two doors freeze a vendor's payout, and
 * #431's own finding was that one of them announced the freeze to the vendor
 * and the other did not. This one places no hold at all — a report about a
 * profile, a review, a thread or a photo has no payout to freeze — so there is
 * nothing to announce, and the asymmetry cannot come back through here. A
 * booking is deliberately not a reportable subject for exactly that reason:
 * `POST /support/messages` owns that path end to end, hold and notice and
 * unwind, and a second entry point is how the two would come to disagree about
 * when a payout stops.
 *
 * **The row is the delivery here, and the email is the nudge — the opposite way
 * round from `/support/messages`, deliberately.**
 *
 * That form's row is a note beside an email a human answers, so a failed send
 * means the complaint reached nobody and 502 is the truth. A report is answered
 * by nobody: it is worked from `/admin/cases`, which reads the row. So a report
 * whose row is written **has arrived**, whatever the mail service did, and
 * telling its author otherwise is false twice over — it invites a retry that
 * files a duplicate case and spends one of their six an hour, while the
 * operator's queue quietly fills with the same complaint.
 *
 * Found by driving it: an unverified `EMAIL_FROM` sender made every report 502
 * while every one of them was sitting in the queue. So the halves swap. The row
 * failing is the 502, because then there is genuinely nothing; the send failing
 * is recorded on the case with `email_failed_at` — which is what that column
 * was added for — and the reporter still gets their reference.
 */

export interface ReportDeps {
  db: AppDatabase;
  email: EmailGateway;
  log: FastifyBaseLogger;
  /** `SUPPORT_EMAIL_TO`. Never a literal — see the registry row. */
  to: string;
}

/**
 * The sentence an operator reads, composed by the platform from the two enums
 * the reporter picked and the row their subject resolved to.
 *
 * **The reporter's own words are a separate paragraph and are labelled.** The
 * chargeback path states the same rule in its own message — *"Nobody typed this
 * message"* — and it matters more here: everything above the label is the
 * platform's account of what was reported, and everything below is one side of
 * a dispute. An operator ruling on a case has to be able to tell those apart at
 * a glance.
 */
function composeReportMessage(input: CreateReportInput, subject: ReportSubjectProjection): string {
  const opening =
    `A signed-in account reported this ${REPORT_SUBJECT_LABELS[input.subjectType].toLowerCase()} ` +
    `on ${subject.vendorBusinessName}'s storefront (/vendors/${subject.vendorSlug}). ` +
    `Reason: ${REPORT_REASON_LABELS[input.reason]}.`;

  if (input.detail === undefined || input.detail === '') {
    return `${opening}\n\nThey added no further detail.`;
  }

  return `${opening}\n\nWhat they wrote:\n\n${input.detail}`;
}

/**
 * Resolves the subject, or refuses.
 *
 * **A non-participant reporting a thread gets the same 404 as a thread that
 * does not exist**, and that is deliberate rather than lazy: a 403 here would
 * confirm that a given uuid is a real conversation to anybody who guessed one,
 * which is the single fact this route must not leak. `web-route-boundaries.md`
 * calls the id in a request attacker-controlled, and this is what that means
 * for a private subject.
 */
async function resolveSubject(
  deps: ReportDeps,
  user: AuthenticatedUser,
  input: CreateReportInput,
): Promise<ReportSubjectProjection> {
  const subject = await findReportSubject(deps.db, input.subjectType, input.subjectId);

  if (!subject) {
    throw notFound('We could not find what you are reporting');
  }

  if (subject.restrictedTo.length > 0 && !subject.restrictedTo.includes(user.id)) {
    throw notFound('We could not find what you are reporting');
  }

  return subject;
}

/**
 * Files one report and hands back its reference.
 *
 * Resolve every refusal first, then write the row, then send. Writing earlier
 * would file cases for reports that were refused; writing later would leave a
 * failed send with nothing to record the failure on.
 */
export async function createReport(
  deps: ReportDeps,
  user: AuthenticatedUser,
  input: CreateReportInput,
  reference: string,
  now: Date,
): Promise<ReportReceipt> {
  const subject = await resolveSubject(deps, user, input);
  const account = await findUserEmail(deps.db, user.id);

  if (!account) {
    /*
     * The session resolved to a user row that has since been soft-deleted —
     * the same state `resolveReplyTo` refuses on the support form, and for the
     * same reason: there is no address to answer and no account to attribute.
     */
    throw unauthorized();
  }

  const message = composeReportMessage(input, subject);

  const reportCase = await openReportCase(deps, {
    reference,
    message,
    senderUserId: user.id,
    senderEmail: account.email,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    reason: input.reason,
  });

  if (!reportCase) {
    /*
     * The one failure that really does lose the report. `openReportCase` has
     * already logged the driver's code — never the reporter's text — so this
     * adds the answer and nothing else.
     *
     * No reference in `details`: on the support form a reference is worth
     * quoting because a message the mail service refused was still logged, and
     * here there is no row to quote it against. Handing over a code that
     * resolves to nothing is worse than handing over none.
     */
    throw new AppError(
      502,
      ERROR_CODES.INTERNAL_ERROR,
      'We could not file that report. Try again in a moment.',
    );
  }

  const notice = renderReportNotice({
    reference,
    subjectLabel: REPORT_SUBJECT_LABELS[input.subjectType],
    reasonLabel: REPORT_REASON_LABELS[input.reason],
    vendorBusinessName: subject.vendorBusinessName,
    message,
    replyTo: account.email,
  });

  try {
    await deps.email.send({
      to: deps.to,
      subject: notice.subject,
      html: notice.html,
      text: notice.text,
      replyTo: account.email,
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    /*
     * **Recorded, not raised.** The case is already in the queue an operator
     * works, so the report has arrived; what failed is the nudge telling them
     * to look. `email_failed_at` is exactly the column for that, and the case
     * detail already renders it as the one state an operator has to chase
     * rather than work.
     *
     * The reference and the failure, never the address and never the detail —
     * `cases.service.ts` sets out at length why a transport error must not be
     * handed to the logger with user-written content bound to it.
     */
    deps.log.error(
      { reference, subjectType: input.subjectType, err: error },
      'A report was filed but its notice did not reach the support inbox',
    );

    await recordCaseSendFailure(deps, reportCase, now);
  }

  /*
   * **No receipt to the reporter**, and unlike the support form that is a
   * decision rather than an omission. A report is filed about somebody, often
   * about harassment, and an unsolicited mail landing in a shared or monitored
   * inbox is the one way filing one could cost the person who filed it. They
   * have the reference on screen, which is the whole of what a receipt carries.
   */
  return { reference };
}
