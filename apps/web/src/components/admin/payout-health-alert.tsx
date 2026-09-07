import Link from 'next/link';
import { Banner } from '@/components/ui/banner';

/**
 * The one list both numbers lead to.
 *
 * They are two readings of the same set — how many transfers are failing, and
 * how many vendors that is — so they cannot lead anywhere different. Counting
 * blocked vendors over a *wider* set and pointing them at `Payouts: not
 * connected` was the first shape of this, and it lied by arithmetic: "1 vendor
 * is owed money we cannot send", clicked, and a list of every vendor who never
 * finished onboarding, with nothing marking the one.
 */
const FAILING_PAYOUTS_PATH = '/admin/payments?flag=payout-failing';

export interface PayoutHealthAlertProps {
  /** Distinct vendors among the failing transfers. */
  blockedVendors: number;
  /** Bookings the sweep still owes and has already tried. */
  failingBookings: number;
}

/**
 * Money the platform holds and cannot send — #432's Overview alert.
 *
 * Rendered **only when there is something to say**, and that is the design
 * rather than a shortcut. Two zeros beside four metric cards would be a
 * permanent line about nothing, and the state it names is rare and urgent: a
 * transfer failing every quarter of an hour used to produce no signal anywhere
 * in the console, so a vendor could be owed money for a week with the platform
 * unaware.
 *
 * Both numbers are query results read at request time, and the sentence leads
 * to the rows behind them — a count an operator cannot act on is the furniture
 * `page.tsx` already warns about.
 */
export function PayoutHealthAlert({
  blockedVendors,
  failingBookings,
}: PayoutHealthAlertProps): React.ReactElement | null {
  if (failingBookings === 0) {
    return null;
  }

  return (
    <Banner status="failed" title="Payouts need attention" className="mb-4">
      <Link href={FAILING_PAYOUTS_PATH} className="font-semibold underline">
        {failingBookings} {failingBookings === 1 ? 'transfer is' : 'transfers are'} failing
        {blockedVendors > 1 ? `, across ${blockedVendors} vendors` : ''}
      </Link>
      {'. '}
      The scheduled release keeps trying, so this clears itself once the accounts are in order.
    </Banner>
  );
}
