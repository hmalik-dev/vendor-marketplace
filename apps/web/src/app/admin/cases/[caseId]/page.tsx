import { notFound } from 'next/navigation';
import { formatPrice, REPORT_SUBJECT_LABELS, uuidSchema } from '@vendor-marketplace/shared';
import {
  Absent,
  AdminCard,
  DetailHeader,
  KeyValue,
  KeyValueList,
  ScopeChip,
} from '@/components/admin/admin-detail';
import { CaseConversation, THREAD_CHIP, THREAD_SCOPE } from '@/components/admin/case-conversation';
import { CaseResolution } from '@/components/admin/case-resolution';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION, PAYOUT_PRESENTATION } from '@/lib/booking-entries';
import { getAdminCase } from '@/lib/admin-data';
import {
  ageInDays,
  ageTone,
  CASE_ARRIVAL,
  CASE_PRESENTATION,
  caseSubject,
} from '@/lib/case-presentation';

/*
 * **24-hour, like `/admin/activity` and like Pattern C** (#454).
 *
 * `timeStyle: 'short'` renders `12:16 AM`, and the frame draws `opened 4 Sep
 * 2026, 09:12`. The argument the delta makes for the activity log applies
 * unchanged here — `2:02 PM` is a form a reader has to disambiguate before
 * comparing two rows — and the two screens are one click apart, so a console
 * that switched conventions between them would be worse than either alone.
 *
 * Written out rather than `timeStyle`, which has no 24-hour option that also
 * keeps a medium date.
 */
const FILED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/*
 * The payout pill reads `PAYOUT_PRESENTATION`, and the private copy this
 * replaces is exactly the drift that map's own docstring warns about (#454):
 * it painted `held` red, which `40-states.md` reserves for failure, and it
 * named one state three different ways against `/admin/payments`.
 */

/**
 * One case, composed to Pattern C (#431, #393).
 *
 * **Three numbered regions, in the order an operator must read them to be
 * allowed to act**: the complaint, the booking it froze, then the resolve
 * control. At 1440 they sit in two columns — 1 and 3 on the left, 2 on the
 * right — but the DOM, and so the reading and tab order, stays 1 → 2 → 3, so
 * the control is still reachable only past the evidence. Grid placement moves
 * region 3 up the left column; it does not move it ahead of region 2 for a
 * keyboard or a screen reader. The numbers stay visible so somebody who jumped
 * to the bottom can see what they skipped.
 */
export default async function AdminCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}): Promise<React.ReactElement> {
  const { caseId } = await params;

  /*
   * `params` is attacker-controlled like `searchParams`
   * (`.claude/rules/web-route-boundaries.md`): an id that is not a uuid would
   * reach the API, come back 400, and render the 500 page for a URL anyone can
   * paste. A malformed id cannot name a case, so it is the `notFound()` case.
   */
  if (!uuidSchema.safeParse(caseId).success) {
    notFound();
  }

  const supportCase = await getAdminCase(caseId);

  /*
   * A well-formed uuid that names nothing is the same answer as a malformed one:
   * the case does not exist. Both are `notFound()`, and neither is the 500 page.
   */
  if (!supportCase) {
    notFound();
  }

  const booking = supportCase.booking;
  const sender = supportCase.senderName ?? supportCase.senderEmail ?? 'The card network';
  const age = ageInDays(supportCase.createdAt, Date.now());
  const thread = supportCase.subjectType === 'conversation' ? supportCase.subjectId : null;
  const moneyOnHold = booking?.status === 'disputed' && supportCase.status === 'open';

  /*
   * Stated rather than left to be inferred. Stripe's outcome and this
   * platform's disposition are different facts, and an operator who read
   * "lost" as "settled" would leave a payout frozen for ever.
   */
  const chargebackRows = supportCase.stripeDisputeId ? (
    <>
      <KeyValue label="Chargeback" kind="mono">
        {supportCase.stripeDisputeId}
      </KeyValue>
      <KeyValue label="Network outcome">
        {supportCase.networkOutcome ?? <Absent>Still with the network</Absent>}
      </KeyValue>
    </>
  ) : null;
  const chargebackNote = supportCase.stripeDisputeId ? (
    <p className="border-t border-stone-150 px-4 py-2.5 text-helper leading-prose text-stone-600">
      The network&apos;s answer does not resolve the case. Rule in region 3 once you have decided
      what the platform is doing about it.
    </p>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader
        crumb={{ label: 'Cases', href: '/admin/cases' }}
        current={supportCase.reference}
        heading={caseSubject(supportCase)}
        pills={
          <StatusPill tone={CASE_PRESENTATION[supportCase.status].tone}>
            {CASE_PRESENTATION[supportCase.status].label}
          </StatusPill>
        }
        stat={
          <>
            <span className="font-mono text-helper">{supportCase.reference}</span> · filed{' '}
            {FILED.format(supportCase.createdAt)} UTC
            {supportCase.resolvedAt ? (
              ` · resolved ${FILED.format(supportCase.resolvedAt)} UTC`
            ) : (
              <>
                {' · '}
                <span className={`font-semibold ${ageTone(age)}`}>{age}d old</span>
              </>
            )}
          </>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-4 pb-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <AdminCard
          readOnly
          title="1 · The complaint"
          note={
            <span className="text-stone-600">
              {CASE_ARRIVAL[supportCase.origin]} · {FILED.format(supportCase.createdAt)} UTC
            </span>
          }
          className="self-start lg:col-start-1 lg:row-start-1"
        >
          <div className="px-4 py-3.5">
            <div data-sender className="mb-2.5 flex items-center gap-2.5">
              <Avatar name={sender} size="xs" />
              <div className="min-w-0">
                <p className="text-action font-semibold text-stone-900">{sender}</p>
                <p className="text-helper [overflow-wrap:anywhere] text-stone-600">
                  {supportCase.senderUserId ? (
                    <>
                      Account ·{' '}
                      <span className="font-mono text-xs">{supportCase.senderUserId}</span>
                    </>
                  ) : supportCase.origin === 'chargeback' ? (
                    'Stripe webhook · no one to answer'
                  ) : (
                    'Signed out'
                  )}
                  {/* A nameless sender is already named by their address above. */}
                  {supportCase.senderEmail && supportCase.senderName
                    ? ` · ${supportCase.senderEmail}`
                    : ''}
                </p>
              </div>
            </div>
            {/*
              `whitespace-pre-wrap`: this is what somebody typed into a textarea,
              and collapsing their paragraphs would make a four-paragraph account
              of what went wrong into one block an operator has to re-read.
            */}
            <p
              data-message-inset
              className="rounded-lg border border-stone-200 bg-stone-50 px-[15px] py-[13px] text-base leading-[1.75] break-words whitespace-pre-wrap text-stone-900"
            >
              {supportCase.message}
            </p>
            <p className="mt-2.5 text-helper text-stone-600">
              Message shown in full — case bodies are never clamped.{' '}
              {[...supportCase.message].length.toLocaleString('en-US')} characters.
            </p>

            {supportCase.emailFailedAt ? (
              <p role="alert" className="mt-3 text-sm text-error-500">
                {/*
                  Two sentences, because the same column means two different
                  things depending on the door (#436). A support message *is*
                  the email, so a refused send means the complaint reached
                  nobody; an in-product report is this case row, so what failed
                  is the notice.
                */}
                {supportCase.origin === 'user_report'
                  ? 'This report is filed, but the notice telling us to look at it was refused by the mail service on '
                  : 'This report never reached the support inbox — the mail service refused it on '}
                {FILED.format(supportCase.emailFailedAt)} UTC.{' '}
                {/*
                  Three states, derived rather than asserted: most cases name no
                  booking, and an unwind whose compensation failed leaves the
                  booking `disputed`, so a fixed "nothing is frozen" would be a
                  claim about money the code cannot make.
                */}
                {!booking
                  ? 'No booking was named, so no payout was ever held.'
                  : booking.payoutStatus === 'held'
                    ? 'The payout is still on hold — the withdrawal did not go through, so rule on it below.'
                    : 'The payout hold was withdrawn, so nothing is frozen.'}{' '}
                {supportCase.origin === 'user_report'
                  ? 'Work it from here as usual.'
                  : 'Answer the sender from here.'}
              </p>
            ) : null}
            {supportCase.holdRefusal ? (
              <p role="alert" className="mt-3 text-sm text-error-500">
                The payout could not be put on hold: {supportCase.holdRefusal}
              </p>
            ) : null}
          </div>
        </AdminCard>

        <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {booking ? (
            <AdminCard
              readOnly
              title="2 · The booking it froze"
              note={
                <StatusPill tone={BOOKING_PRESENTATION[booking.status].tone}>
                  {BOOKING_PRESENTATION[booking.status].label}
                </StatusPill>
              }
            >
              {/* Parsed as UTC midnight: a calendar date read in local time
                  moves a day for anyone west of UTC. */}
              <p className="px-4 pt-3 text-action text-stone-900">
                {booking.customerName} ·{' '}
                {EVENT_DATE.format(new Date(`${booking.eventDate}T00:00:00Z`))} ·{' '}
                {booking.vendorName}
              </p>
              <KeyValueList className="pt-2">
                <KeyValue label="Booking" kind="mono">
                  {booking.id}
                </KeyValue>
                <KeyValue label="Total" kind="mono">
                  {formatPrice(booking.totalAmountCents)}
                </KeyValue>
                <KeyValue label="Platform fee" kind="mono">
                  {formatPrice(booking.platformFeeCents)}
                </KeyValue>
                <KeyValue label="Vendor payout" kind="mono">
                  {formatPrice(booking.vendorPayoutCents)}{' '}
                  <StatusPill tone={PAYOUT_PRESENTATION[booking.payoutStatus].tone}>
                    {PAYOUT_PRESENTATION[booking.payoutStatus].label}
                  </StatusPill>
                </KeyValue>
                <KeyValue label="Paid at" kind="mono">
                  {booking.paidAt ? `${FILED.format(booking.paidAt)} UTC` : <Absent />}
                </KeyValue>
                <KeyValue label="Payout released" kind="mono">
                  {booking.payoutReleasedAt ? (
                    `${FILED.format(booking.payoutReleasedAt)} UTC`
                  ) : (
                    <Absent />
                  )}
                </KeyValue>
                <KeyValue label="Refund amount" kind="mono">
                  {booking.refundAmountCents === null ? (
                    <Absent />
                  ) : (
                    formatPrice(booking.refundAmountCents)
                  )}
                </KeyValue>
                <KeyValue label="Cancelled by">{booking.cancelledBy ?? <Absent />}</KeyValue>
                {/*
                  **Red, and called by its own name** — Pattern C (#454). One of
                  exactly three things the delta spends red on: a failed payout
                  attempt, a chargeback, and this — the reason the network or
                  the customer gave for the money being in dispute.
                */}
                {booking.disputeReason ? (
                  <KeyValue label="Dispute reason">
                    <span className="font-semibold text-error-500">{booking.disputeReason}</span>
                  </KeyValue>
                ) : null}
                {chargebackRows}
                <KeyValue label="Payment intent" kind="mono">
                  {booking.stripePaymentIntentId ?? <Absent />}
                </KeyValue>
              </KeyValueList>
              {chargebackNote}
            </AdminCard>
          ) : chargebackRows ? (
            <AdminCard readOnly title="The chargeback">
              <KeyValueList>{chargebackRows}</KeyValueList>
              {chargebackNote}
            </AdminCard>
          ) : null}

          {supportCase.subjectType && supportCase.subjectId && !thread ? (
            <AdminCard readOnly title="What was reported">
              {/*
                The other three subjects are already public — a storefront, a
                review, a published photograph — so the case names the id and
                links nothing an operator cannot already open.
              */}
              <KeyValueList>
                <KeyValue label={REPORT_SUBJECT_LABELS[supportCase.subjectType]} kind="mono">
                  {supportCase.subjectId}
                </KeyValue>
              </KeyValueList>
            </AdminCard>
          ) : null}

          {/*
            Pattern C §2. With a thread, the component draws the whole card:
            its chip prints the dates the read was limited to, and only the
            response knows them (VEN-412).
          */}
          {thread ? (
            <CaseConversation conversationId={thread} />
          ) : (
            <AdminCard
              title="Reported thread"
              note={<ScopeChip>{THREAD_CHIP}</ScopeChip>}
              className="flex flex-col"
            >
              <div className="px-4 py-3">
                <p className="text-sm text-stone-600">
                  This case names no conversation, so there is no thread to read.
                </p>
                <p className="mt-3 border-t border-stone-150 pt-2.5 text-helper leading-prose text-stone-600">
                  {THREAD_SCOPE}
                </p>
              </div>
            </AdminCard>
          )}
        </div>

        <AdminCard
          tone="clay"
          title="3 · Resolve"
          note={moneyOnHold ? 'Moves money. Both positions confirm first.' : undefined}
          className="self-start lg:col-start-1 lg:row-start-2"
        >
          <div className="px-4 py-3.5">
            <CaseResolution supportCase={supportCase} />
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
