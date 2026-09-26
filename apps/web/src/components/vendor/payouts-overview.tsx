import {
  BRAND_NAME,
  EVENT_TYPE_LABELS,
  PAYOUT_RELEASE_HOURS,
  formatPrice,
  parseDateString,
} from '@vendor-marketplace/shared';
import { Banner } from '@/components/ui/banner';
import { StatusPill } from '@/components/ui/status-pill';
import { StripeDashboardLink } from '@/components/vendor/stripe-dashboard-link';
import { payoutBreakdown } from '@/lib/payout-breakdown';
import { formatPayoutDay } from '@/lib/payout-date';
import type { WireVendorPayouts } from '@/lib/wire-schemas';

type PayoutRow = WireVendorPayouts['rows'][number];

export interface PayoutsOverviewProps {
  payouts: WireVendorPayouts;
}

const CARD = 'rounded-[14px] bg-stone-0 px-5 py-4.5 shadow-sm';
const CARD_LABEL = 'text-label font-semibold tracking-label text-stone-600 uppercase';
const CARD_FIGURE = 'mt-1.5 font-display text-[32px] leading-none text-stone-900';
const CARD_NOTE = 'mt-1 text-[12.5px] text-stone-700';
const CELL = 'truncate px-2 first:pl-4 last:pr-4';

/** `Nandakumar wedding` — the customer's name and the kind of event, as frame `49` writes a booking. */
function bookingLabel(row: Pick<PayoutRow, 'customerName' | 'eventType'>): string {
  const eventType = row.eventType ? EVENT_TYPE_LABELS[row.eventType].toLowerCase() : 'booking';

  return row.customerName === '' ? eventType : `${row.customerName} ${eventType}`;
}

function eventDay(date: string): string {
  const parsed = parseDateString(date);

  return parsed ? formatPayoutDay(parsed) : date;
}

/** The release column: when it was paid, when it will be, or why there is no date. */
function releaseCell(row: PayoutRow): string {
  if (row.paidAt) {
    return formatPayoutDay(row.paidAt);
  }

  return row.releaseAt ? formatPayoutDay(row.releaseAt) : 'After review';
}

/**
 * The onboarded vendor's payments page (VEN-768, frame `49`): what pays out
 * next, what the platform is holding, where it is paid to, and every payout.
 *
 * "Held" is gold because it is waiting on the clock, not failing; a dispute is
 * held too, with no date until it is resolved (`40-states.md`).
 */
export function PayoutsOverview({ payouts }: PayoutsOverviewProps): React.ReactElement {
  const { summary, account, rows } = payouts;
  const next = summary.next;
  const nextRow = rows.find((row) => row.bookingId === payouts.nextBookingId);
  const sentCents =
    next &&
    payoutBreakdown(next.cents, summary.debtOutstandingCents, summary.backupWithholding).sentCents;
  const onHoldCents = summary.pendingCents + summary.heldCents;
  const onHoldCount = summary.pendingCount + summary.heldCount;

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <section className={CARD} aria-labelledby="next-payout">
          <h2 id="next-payout" className={CARD_LABEL}>
            Next payout
          </h2>
          <p className={CARD_FIGURE}>{sentCents === null ? '—' : formatPrice(sentCents)}</p>
          <p className={CARD_NOTE}>
            {next === null
              ? 'Nothing to pay out yet'
              : [
                  next.isDue ? 'Paying out now' : formatPayoutDay(next.releaseAt),
                  nextRow ? bookingLabel(nextRow) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </section>

        <section className={CARD} aria-labelledby="on-hold">
          <h2 id="on-hold" className={CARD_LABEL}>
            On hold
          </h2>
          <p className={CARD_FIGURE}>{formatPrice(onHoldCents)}</p>
          {onHoldCount === 0 && <p className={CARD_NOTE}>Nothing on hold</p>}
          {summary.pendingCount > 0 && (
            <p className={CARD_NOTE}>
              {`${summary.pendingCount} ${summary.pendingCount === 1 ? 'booking' : 'bookings'}, each released ${PAYOUT_RELEASE_HOURS} hours after its event`}
            </p>
          )}
          {summary.heldCount > 0 && (
            <p className="mt-1 text-[12.5px] text-gold-600">
              {formatPrice(summary.heldCents)} held while a reported problem is reviewed
            </p>
          )}
        </section>

        <section className={CARD} aria-labelledby="payout-account">
          <h2 id="payout-account" className={CARD_LABEL}>
            Payout account
          </h2>
          <p className="mt-2 text-sm font-semibold text-stone-900">
            {account ? `${account.bankName ?? 'Bank'} ···· ${account.last4}` : 'Managed in Stripe'}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-sage-600">
            <span aria-hidden="true" className="size-2 rounded-full bg-sage-400" />
            Stripe Connect · payouts enabled
          </p>
          <div className="mt-1.5 -ml-2">
            <StripeDashboardLink label="Manage in Stripe" />
          </div>
        </section>
      </div>

      <div className="mt-3.5">
        <Banner status="informational" title="Why payouts wait">
          Each payment is held by {BRAND_NAME} until {PAYOUT_RELEASE_HOURS} hours after the event,
          then transferred to your account. That window is when a customer can report a problem.
        </Banner>
      </div>

      <h2 className="mt-5 mb-2.5 font-display text-[19px] text-stone-900">Payouts</h2>
      <div className="overflow-hidden rounded-xl border border-stone-300 bg-stone-0">
        <table className="w-full table-fixed text-left text-[13px] text-stone-700">
          {/*
            Frame `49`'s `1.4fr 1.1fr .9fr .9fr .8fr`. A fixed table spreads
            spare width across its columns in proportion, so these scale as the
            frame's fractions do.
          */}
          <colgroup>
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[80px]" />
          </colgroup>
          <thead className="bg-stone-100">
            <tr className="h-9.5 border-b border-stone-300 text-label font-semibold tracking-label text-stone-600 uppercase">
              <th scope="col" className={CELL}>
                Booking
              </th>
              <th scope="col" className={CELL}>
                Event
              </th>
              <th scope="col" className={CELL}>
                Amount
              </th>
              <th scope="col" className={CELL}>
                Release
              </th>
              <th scope="col" className={CELL}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="h-11">
                <td colSpan={5} className="px-4 text-stone-600">
                  No payouts yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.bookingId}
                  className="h-11 border-b border-stone-150 last:border-b-0 even:bg-stone-25"
                >
                  <td className={`${CELL} font-semibold text-stone-900`}>{bookingLabel(row)}</td>
                  <td className={CELL}>{eventDay(row.eventDate)}</td>
                  <td className={CELL}>{formatPrice(row.cents)}</td>
                  <td className={CELL}>{releaseCell(row)}</td>
                  <td className={CELL}>
                    {row.payoutStatus === 'released' ? (
                      <StatusPill tone="confirmed">Paid</StatusPill>
                    ) : (
                      <StatusPill tone="pending">Held</StatusPill>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
