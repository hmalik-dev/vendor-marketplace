import { MONEY_COPY, formatPrice } from '@vendor-marketplace/shared';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface NextPayoutProps {
  payout: WireVendorDashboard['nextPayout'];
}

/**
 * What the vendor is owed next, and for whose event.
 *
 * **The date is the event's, not the payout's** — and that is a recorded
 * deviation from frame `27 Vendor dashboard — 1024`, which draws
 * `Anjali N. · pays out Jun 15`. There is no payout schedule to read a date
 * from until #10, so a payout date here could only be invented, on the one
 * surface where the vendor can tell. The event date is a real column, and
 * `MONEY_COPY.vendorPayout` already states the mechanism that connects them:
 * money moves after the event. See `16-vendor-dashboard.md`.
 *
 * The amount is not a deviation. `vendor_payout_cents` is settled at payment,
 * so it is exactly what will arrive.
 */
export function NextPayout({ payout }: NextPayoutProps): React.ReactElement {
  return (
    <div className="rounded-[13px] bg-stone-0 p-3.75 shadow-sm">
      <h3 className="mb-2.25 text-label font-semibold tracking-label text-stone-600 uppercase">
        Next payout
      </h3>
      {/*
        An em dash rather than `$0.00`. A vendor with nothing booked is owed
        nothing yet, which is not the same claim as being owed zero — the same
        reason the stats row writes `—` for a rating nobody has given.
      */}
      <p className="font-display text-[26px] leading-none text-stone-900">
        {payout === null ? '—' : formatPrice(payout.vendorPayoutCents)}
      </p>
      <p className="mt-0.75 text-helper text-stone-600">
        {payout === null
          ? MONEY_COPY.vendorPayout
          : `${payout.customerFirstName} · after the event on ${EVENT_DATE.format(
              new Date(`${payout.eventDate}T00:00:00Z`),
            )}`}
      </p>
    </div>
  );
}
