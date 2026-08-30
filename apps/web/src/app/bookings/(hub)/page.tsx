import type { Metadata } from 'next';
import { pageTitle, todayDateString } from '@vendor-marketplace/shared';
import { BookingsHub, BOOKING_TABS } from '@/components/bookings/bookings-hub';
import { BookingsRail } from '@/components/bookings/bookings-rail';
import { BookingsSidebar } from '@/components/bookings/bookings-sidebar';
import { toEntries, type BookingTab } from '@/lib/booking-entries';
import { getOwnBookingRequests, getOwnBookings } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your bookings'),
  robots: { index: false, follow: false },
};

/**
 * Never prerendered. The `loading.tsx` beside this file gives Next a shell it
 * could otherwise try to statically generate, and this page resolves the signed-in
 * customer before it can render anything — which is not a question a build has an
 * answer to.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

function isTab(value: string | undefined): value is BookingTab {
  return (BOOKING_TABS as readonly string[]).includes(value ?? '');
}

/**
 * Frame `07` — one standing home for every vendor booking the customer makes.
 *
 * **The page itself does not scroll**; the list pane and the rail scroll
 * independently, which is what keeps the summary and the tabs in place while
 * a long history is read.
 */
export default async function BookingsPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const query = await searchParams;
  const tab: BookingTab = isTab(query.tab) ? query.tab : 'upcoming';

  /*
   * The tab travels through sign-in, so a link to a specific tab still lands on
   * that tab afterwards. Only the validated value is carried — an unrecognised
   * `?tab=` is already dropped above and must not be reintroduced by the
   * return trip.
   */
  const user = await requireRole('customer', `/bookings?tab=${tab}`);

  const [requests, bookings] = await Promise.all([getOwnBookingRequests(), getOwnBookings()]);
  const entries = toEntries(requests, bookings);
  const today = todayDateString();

  // Clay is reserved for the reader's own move, and a quote is exactly that.
  const needsYou = entries.filter((entry) => entry.status === 'quoted');

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <BookingsSidebar bookingCount={entries.length} current="bookings" />
      <BookingsHub entries={entries} tab={tab} today={today} city={user.city} needsYou={needsYou} />
      <BookingsRail needsYou={needsYou} />
    </div>
  );
}
