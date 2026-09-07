import Link from 'next/link';

/** The two lists the numbers lead to — where each state is actually worked on. */
const FAILING_PAYOUTS_PATH = '/admin/payments?flag=payout-failing';
const BLOCKED_VENDORS_PATH = '/admin/vendors?payouts=not-connected';

export interface PayoutHealthAlertProps {
  /** Vendors owed money their Stripe account cannot receive. */
  blockedVendors: number;
  /** Bookings whose transfer has been tried and has not landed. */
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
 * Both numbers are query results read at request time. Each is a link, because
 * a count an operator cannot act on is the furniture `page.tsx` already warns
 * about — and the two go to different lists because they are different
 * problems: one is fixed at Stripe by the vendor, the other by retrying.
 */
export function PayoutHealthAlert({
  blockedVendors,
  failingBookings,
}: PayoutHealthAlertProps): React.ReactElement | null {
  if (blockedVendors === 0 && failingBookings === 0) {
    return null;
  }

  return (
    <p
      role="status"
      className="mb-4 rounded-xl border border-error-500 bg-stone-0 px-4 py-3 text-sm text-stone-900"
    >
      <span className="font-semibold text-error-500">Payouts need attention.</span>{' '}
      {failingBookings > 0 ? (
        <>
          <Link href={FAILING_PAYOUTS_PATH} className="font-semibold underline">
            {failingBookings} {failingBookings === 1 ? 'transfer is' : 'transfers are'} failing
          </Link>
          {blockedVendors > 0 ? ', and ' : '. '}
        </>
      ) : null}
      {blockedVendors > 0 ? (
        <>
          <Link href={BLOCKED_VENDORS_PATH} className="font-semibold underline">
            {blockedVendors} {blockedVendors === 1 ? 'vendor is' : 'vendors are'} owed money Stripe
            will not let us send
          </Link>
          {'. '}
        </>
      ) : null}
      The scheduled release keeps trying, so this clears itself once the accounts are in order.
    </p>
  );
}
