import { MONEY_COPY, formatPrice } from '@vendor-marketplace/shared';
import { formatPayoutDate } from '@/lib/payout-date';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

export interface NextPayoutProps {
  payouts: WireVendorDashboard['payouts'];
  /** The server's UTC day, so the release date's year is judged against it. */
  serverToday: string;
}

/**
 * What the vendor is paid next, what is behind it, and what a dispute is
 * holding.
 *
 * **The frame deviation this card carried is closed.** Frame
 * `27 Vendor dashboard — 1024` writes the second line as
 * `Anjali N. · pays out Jun 15`, and #308 could not build it: there was no
 * payout schedule to read a date from, so the date could only be invented, on
 * the one surface where the vendor can tell. #423 created the schedule, so the
 * date is a real derivation from a real column and the card says it.
 *
 * **The big figure is the next payout's own amount, not the total.** Those are
 * different numbers the moment a vendor has two bookings, and only the first
 * one has the date printed under it — `$9,500 · pays out Jun 18` when $500 pays
 * out on the 18th is precisely the figure-versus-transfer disagreement this
 * ticket exists to prevent. The total gets its own line, undated, and only when
 * there is more than one payout for it to total.
 *
 * Every amount is a stored `vendor_payout_cents`, never a recomputed fee. An em
 * dash rather than `$0.00` when nothing is pending: a vendor owed nothing yet
 * is not a vendor owed zero, the same reason the stats row writes `—` for a
 * rating nobody has given.
 *
 * Held money is a **separate line in gold, never added to either figure**.
 * `40-states.md` rules gold as waiting on someone and red as failure, and a
 * dispute is waiting: the money is still owed, it simply has no date.
 */
export function NextPayout({ payouts, serverToday }: NextPayoutProps): React.ReactElement {
  const { pendingCents, pendingCount, next, heldCents, heldCount } = payouts;

  return (
    <div className="rounded-[13px] bg-stone-0 p-3.75 shadow-sm">
      <h3 className="mb-2.25 text-label font-semibold tracking-label text-stone-600 uppercase">
        Next payout
      </h3>
      <p className="font-display text-[26px] leading-none text-stone-900">
        {next === null ? '—' : formatPrice(next.cents)}
      </p>
      {next === null && heldCount === 0 && (
        <p className="mt-0.75 text-helper text-stone-600">{MONEY_COPY.vendorPayout}</p>
      )}
      {next !== null && (
        /*
          `Paying out now` once the release window has closed. The date is real
          either way, but a transfer that keeps failing stays pending and its
          date recedes, so "pays out" beside a date three weeks gone would be
          the card asserting a future that has already passed.
        */
        <p className="mt-0.75 text-helper text-stone-600">
          {next.customerFirstName === '' ? '' : `${next.customerFirstName} · `}
          {next.isDue
            ? 'paying out now'
            : `pays out ${formatPayoutDate(next.releaseAt, serverToday)}`}
        </p>
      )}
      {pendingCount > 1 && (
        <p className="mt-0.75 text-helper text-stone-600">
          {formatPrice(pendingCents)} pending in total
        </p>
      )}
      {heldCount > 0 && (
        <p className="mt-1.5 text-helper text-gold-600">
          {formatPrice(heldCents)} held while a reported problem is reviewed
        </p>
      )}
    </div>
  );
}
