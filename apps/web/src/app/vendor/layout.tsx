import type { ReactNode } from 'react';
import { VendorNav } from '@/components/vendor-nav';
import { requireRole } from '@/lib/current-user';
import { isNavigationSignal } from '@/lib/navigation-signal';
import { getPayoutStatus } from '@/lib/vendor-data';
import { getOwnBookingRequests } from '@/lib/vendor-requests';

/**
 * Whether payouts are connected, for the rail's Payments dot. A vendor with no
 * payout state yet has not connected. A failed read answers `true`: the dot is
 * a nudge, and drawing it on a vendor whose payouts are fine only because the
 * status could not be read is a claim the rail cannot back.
 */
async function readPayoutsConnected(): Promise<boolean> {
  try {
    return (await getPayoutStatus())?.stripeOnboarded ?? false;
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

    return true;
  }
}

/**
 * Every vendor surface sits beside the same navigation rail — 220px from `lg`,
 * widening to the full 240px sidebar at 1440, per the degradation table in
 * design/design-plan/04-laws.md. Page height is left to each surface: the app
 * shells own their scrolling.
 */
export default async function VendorLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('vendor');

  /*
   * What the rail marks (VEN-772). The count is the dashboard title's source —
   * the pending rows of the same list — so the pill and the heading agree. A
   * failed list read degrades to no pill rather than costing the page.
   */
  const [requests, payoutsConnected] = await Promise.all([
    getOwnBookingRequests(),
    readPayoutsConnected(),
  ]);
  const pendingRequests = requests.filter((request) => request.status === 'pending').length;

  return (
    // A flex row rather than a grid, so a surface that supplies its own rail —
    // the storefront editor does — can drop `VendorNav` and have the content
    // take the full width instead of leaving an empty column.
    <div className="lg:flex lg:items-start">
      <VendorNav pendingRequests={pendingRequests} payoutsConnected={payoutsConnected} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
