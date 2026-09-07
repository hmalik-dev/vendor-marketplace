import Link from 'next/link';
import { Banner } from '@/components/ui/banner';

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
  /*
   * Built as a list rather than as nested ternaries carrying their own commas.
   * Punctuation held inside a branch couples the two clauses: the first one has
   * to know whether the second exists in order to end its own sentence.
   */
  const clauses: React.ReactElement[] = [];

  if (failingBookings > 0) {
    clauses.push(
      <Link key="failing" href={FAILING_PAYOUTS_PATH} className="font-semibold underline">
        {failingBookings} {failingBookings === 1 ? 'transfer is' : 'transfers are'} failing
      </Link>,
    );
  }

  if (blockedVendors > 0) {
    clauses.push(
      <Link key="blocked" href={BLOCKED_VENDORS_PATH} className="font-semibold underline">
        {blockedVendors} {blockedVendors === 1 ? 'vendor is' : 'vendors are'} owed money Stripe will
        not let us send
      </Link>,
    );
  }

  if (clauses.length === 0) {
    return null;
  }

  return (
    <Banner status="failed" title="Payouts need attention" className="mb-4">
      {clauses.map((clause, index) => (
        <span key={clause.key}>
          {index > 0 ? ', and ' : null}
          {clause}
        </span>
      ))}
      . The scheduled release keeps trying, so this clears itself once the accounts are in order.
    </Banner>
  );
}
