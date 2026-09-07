import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatPrice, REPORT_SUBJECT_LABELS, uuidSchema } from '@vendor-marketplace/shared';
import { CaseConversation } from '@/components/admin/case-conversation';
import { CaseResolution } from '@/components/admin/case-resolution';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { getAdminCase } from '@/lib/admin-data';
import { CASE_PRESENTATION, caseSubject } from '@/lib/case-presentation';
import type { WireAdminCaseBooking } from '@/lib/wire-schemas';

const FILED = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The three payout states, in the vocabulary `40-states.md` assigns them. */
const PAYOUT_TONES: Record<WireAdminCaseBooking['payoutStatus'], StatusTone> = {
  pending: 'pending',
  held: 'failed',
  released: 'confirmed',
};

const PAYOUT_LABELS: Record<WireAdminCaseBooking['payoutStatus'], string> = {
  pending: 'Awaiting the sweep',
  held: 'On hold',
  released: 'Paid out',
};

function Card({ title, children }: { title: string; children: ReactNode }): React.ReactElement {
  return (
    <section className="rounded-xl border border-stone-300 bg-stone-0 p-4">
      <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One labelled figure. `font-mono` on the value, as every money cell is. */
function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label font-semibold tracking-label text-stone-600 uppercase">
        {label}
      </span>
      <span className={mono ? 'font-mono text-base text-stone-900' : 'text-base text-stone-900'}>
        {value}
      </span>
    </div>
  );
}

/**
 * One case, and where it is resolved (#431).
 *
 * **Card groupings with the actions prominent**, which is what `22-admin.md`
 * asks of a detail view — not the console's table shell, because nothing here is
 * a list. The money card carries every field `adminBookingRowSchema` omits,
 * because this is the one screen where an operator decides who keeps it.
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1 className="display-heading font-mono text-[23px] text-stone-900">
            {supportCase.reference}
          </h1>
          <StatusPill tone={CASE_PRESENTATION[supportCase.status].tone}>
            {CASE_PRESENTATION[supportCase.status].label}
          </StatusPill>
        </div>
        <Link href="/admin/cases" className="text-sm text-stone-600 hover:underline">
          Back to the queue
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-stone-600">
        {caseSubject(supportCase)} · filed {FILED.format(supportCase.createdAt)} UTC
        {supportCase.resolvedAt ? ` · resolved ${FILED.format(supportCase.resolvedAt)} UTC` : ''}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <Card title="The message">
          {/*
            `whitespace-pre-wrap`: this is what somebody typed into a textarea,
            and collapsing their paragraphs would make a four-paragraph account
            of what went wrong into one block an operator has to re-read.
          */}
          <p className="text-base leading-prose whitespace-pre-wrap text-stone-900">
            {supportCase.message}
          </p>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
            <Field
              label="From"
              value={
                supportCase.senderName ??
                supportCase.senderEmail ?? <span className="text-stone-600">The card network</span>
              }
            />
            <Field
              label="Reply to"
              value={supportCase.senderEmail ?? <span className="text-stone-600">—</span>}
            />
            <Field
              label="Arrived by"
              value={supportCase.origin === 'chargeback' ? 'Stripe webhook' : 'Contact support'}
            />
          </div>

          {supportCase.emailFailedAt ? (
            <p role="alert" className="mt-3 text-sm text-error-500">
              This report never reached the support inbox — the mail service refused it on{' '}
              {FILED.format(supportCase.emailFailedAt)} UTC.{' '}
              {/*
                Three states, and the first one is why this is not two.
                **Most cases have no booking at all** — a general question names
                none — and a sentence about a payout hold being withdrawn is
                then about money that was never involved, on the screen an
                operator reads to find out what happened. A browser pass caught
                exactly that.

                The other two are derived rather than asserted: the unwind that
                takes a hold back off logs its own failure rather than throwing,
                so a send failure whose compensation also failed leaves the
                booking `disputed`, and a fixed "nothing is frozen" would be a
                claim about money that the code cannot make.
              */}
              {!booking
                ? 'No booking was named, so no payout was ever held.'
                : booking.payoutStatus === 'held'
                  ? 'The payout is still on hold — the withdrawal did not go through, so rule on it below.'
                  : 'The payout hold was withdrawn, so nothing is frozen.'}{' '}
              Answer the sender from here.
            </p>
          ) : null}
          {supportCase.holdRefusal ? (
            <p role="alert" className="mt-3 text-sm text-error-500">
              The payout could not be put on hold: {supportCase.holdRefusal}
            </p>
          ) : null}
        </Card>

        {supportCase.subjectType && supportCase.subjectId ? (
          <Card title="What was reported">
            <Field
              label={REPORT_SUBJECT_LABELS[supportCase.subjectType]}
              value={supportCase.subjectId}
              mono
            />
            {/*
              The thread's own card, and only for a thread. The other three
              subjects are already public — a storefront, a review, a published
              photograph — and the case links nothing an operator cannot
              already open. A conversation is the one that needs a grant, so it
              is the one that gets a control.
            */}
            {supportCase.subjectType === 'conversation' ? (
              <div className="mt-3.5">
                <CaseConversation conversationId={supportCase.subjectId} />
              </div>
            ) : null}
          </Card>
        ) : null}

        {supportCase.stripeDisputeId ? (
          <Card title="The chargeback">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stripe dispute" value={supportCase.stripeDisputeId} mono />
              <Field
                label="Network outcome"
                value={
                  supportCase.networkOutcome ?? (
                    <span className="text-stone-600">Still with the network</span>
                  )
                }
              />
            </div>
            {/*
              Stated rather than left to be inferred. Stripe's outcome and this
              platform's disposition are different facts, and an operator who
              read "lost" as "settled" would leave a payout frozen for ever.
            */}
            <p className="mt-3 text-sm text-stone-600">
              The network&apos;s answer does not resolve the case. Rule below once you have decided
              what the platform is doing about it.
            </p>
          </Card>
        ) : null}

        {booking ? (
          <Card title="The booking">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <Link
                href={`/vendors/${booking.vendorSlug}`}
                className="text-base font-semibold text-stone-900 hover:underline"
              >
                {booking.vendorName}
              </Link>
              <span className="text-sm text-stone-600">for {booking.customerName}</span>
              <StatusPill tone={BOOKING_PRESENTATION[booking.status].tone}>
                {BOOKING_PRESENTATION[booking.status].label}
              </StatusPill>
              <StatusPill tone={PAYOUT_TONES[booking.payoutStatus]}>
                {PAYOUT_LABELS[booking.payoutStatus]}
              </StatusPill>
            </div>

            <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
              {/* Parsed as UTC midnight: a calendar date read in local time
                  moves a day for anyone west of UTC. */}
              <Field
                label="Event date"
                value={EVENT_DATE.format(new Date(`${booking.eventDate}T00:00:00Z`))}
              />
              <Field label="Total" value={formatPrice(booking.totalAmountCents)} mono />
              <Field label="Platform fee" value={formatPrice(booking.platformFeeCents)} mono />
              <Field label="Vendor payout" value={formatPrice(booking.vendorPayoutCents)} mono />
              <Field
                label="Refunded"
                value={
                  booking.refundAmountCents === null ? (
                    <span className="text-stone-600">—</span>
                  ) : (
                    formatPrice(booking.refundAmountCents)
                  )
                }
                mono
              />
              <Field
                label="Paid"
                value={
                  booking.paidAt ? (
                    FILED.format(booking.paidAt)
                  ) : (
                    <span className="text-stone-600">—</span>
                  )
                }
              />
              <Field
                label="Payout released"
                value={
                  booking.payoutReleasedAt ? (
                    FILED.format(booking.payoutReleasedAt)
                  ) : (
                    <span className="text-stone-600">Not yet</span>
                  )
                }
              />
              <Field
                label="Cancelled by"
                value={booking.cancelledBy ?? <span className="text-stone-600">—</span>}
              />
              <Field
                label="Payment intent"
                value={booking.stripePaymentIntentId ?? <span className="text-stone-600">—</span>}
                mono
              />
            </div>

            {booking.disputeReason ? (
              <div className="mt-3.5">
                <Field label="Hold reason" value={booking.disputeReason} />
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card title="Resolution">
          <CaseResolution supportCase={supportCase} />
        </Card>
      </div>
    </div>
  );
}
