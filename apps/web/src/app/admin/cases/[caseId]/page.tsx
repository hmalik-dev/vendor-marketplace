import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatPrice, REPORT_SUBJECT_LABELS, uuidSchema } from '@vendor-marketplace/shared';
import { CaseConversation } from '@/components/admin/case-conversation';
import { CaseResolution } from '@/components/admin/case-resolution';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { getAdminCase } from '@/lib/admin-data';
import { CASE_ARRIVAL, CASE_PRESENTATION, caseSubject } from '@/lib/case-presentation';
import { cn } from '@/lib/utils';
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

/**
 * A card, and — for the three that make up Pattern C — its region number.
 *
 * **The numbers are visible on purpose.** The delta stacks the complaint, the
 * booking it froze and the resolve control in the order an operator has to read
 * them to be allowed to act, and puts the control last so it is reachable only
 * past the evidence: *the scroll is half the safeguard and the copy is the
 * other half*. Numbering them is what lets somebody who jumped straight to the
 * bottom see what they skipped — an unnumbered stack in the right order looks
 * identical to one in the wrong order.
 *
 * The chargeback card carries no number. It is conditional — most cases have
 * none — and a numbered sequence that gains and loses a member depending on the
 * row is not a sequence.
 *
 * `3` is drawn on a clay edge, because it is the one that moves money.
 */
function Card({
  title,
  region,
  children,
}: {
  title: string;
  region?: 1 | 2 | 3;
  children: ReactNode;
}): React.ReactElement {
  return (
    <section
      className={cn(
        'rounded-xl border bg-stone-0 p-4',
        region === 3 ? 'border-clay-200' : 'border-stone-300',
      )}
    >
      <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">
        {region ? <span className="text-stone-900">{region} · </span> : null}
        {title}
      </h2>
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
        <Card region={1} title="The complaint">
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
            <Field label="Arrived by" value={CASE_ARRIVAL[supportCase.origin]} />
          </div>

          {supportCase.emailFailedAt ? (
            <p role="alert" className="mt-3 text-sm text-error-500">
              {/*
                Two sentences, because the same column means two different
                things depending on the door (#436).

                A support message *is* the email, so a refused send means the
                complaint reached nobody. An in-product report is this case row
                — an operator works it from the queue whether or not any mail
                went out — so what failed is the notice, and telling an operator
                the report never arrived while they are reading it would be
                plainly false.
              */}
              {supportCase.origin === 'user_report'
                ? 'This report is filed, but the notice telling us to look at it was refused by the mail service on '
                : 'This report never reached the support inbox — the mail service refused it on '}
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
              {/*
                A report has no sender to answer — `/reports` deliberately sends
                the reporter no receipt, so there is no correspondence to
                continue. What it has is a subject to act on.
              */}
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
          <Card region={2} title="The booking it froze">
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

            {/*
              **Red, and called by its own name** — Pattern C (#454).

              The delta draws this field as `Dispute reason` with the value in
              red, and it is one of exactly three things in the whole delta that
              earn red: a payout attempt that failed, a chargeback, and this.
              `40-states.md` reserves red for failure and this is the sentence
              saying what failed — the reason a card network or a customer gave
              for the money being in dispute.

              It rendered as a plain `Hold reason`, which is the platform's
              word for the *consequence* rather than the network's word for the
              cause; an operator comparing this screen to Stripe's dashboard was
              reading two names for one field.
            */}
            {booking.disputeReason ? (
              <div className="mt-3.5">
                <Field
                  label="Dispute reason"
                  value={
                    <span className="font-semibold text-error-500">{booking.disputeReason}</span>
                  }
                />
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card region={3} title="Resolve">
          <CaseResolution supportCase={supportCase} />
        </Card>
      </div>
    </div>
  );
}
