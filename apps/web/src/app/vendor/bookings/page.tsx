import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookingCard } from '@/components/vendor/booking-card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireRole } from '@/lib/current-user';
import { getOwnBookingRequests } from '@/lib/vendor-requests';
import { getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Bookings') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/** A vendor's own committed work — never cached, the same as the calendar. */
export const dynamic = 'force-dynamic';

/**
 * What am I booked for?
 *
 * Until this existed an accepted request vanished: it left the dashboard's
 * pending queue and appeared on no other surface, so the vendor could commit to
 * a date and then have no way to see what they had committed to. The list reads
 * the same endpoint the dashboard does and filters to `accepted`, so the two
 * cannot disagree about what was accepted.
 */
export default async function VendorBookingsPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const requests = await getOwnBookingRequests();
  const booked = requests
    .filter((request) => request.status === 'accepted')
    // Soonest first: the next thing the vendor has to turn up to comes first.
    .sort((left, right) => left.eventDate.localeCompare(right.eventDate));

  return (
    <div data-app-shell className="w-full px-4 pt-5.5 sm:px-6 lg:px-0 lg:pl-6">
      <h1 className="display-heading mb-1 text-[26px] text-stone-900">
        {booked.length === 0
          ? 'Nothing booked yet'
          : `You have ${booked.length} ${booked.length === 1 ? 'booking' : 'bookings'}`}
      </h1>
      <p className="mb-4 text-sm text-stone-700">
        Every request you have accepted, and how to reach the customer.
      </p>

      {booked.length === 0 ? (
        <EmptyState
          panel
          headline="No bookings yet"
          description="A request becomes a booking the moment you accept it. Accepted requests show up here with the customer's contact details."
        />
      ) : (
        <ul className="flex flex-col gap-2.5 pb-6">
          {booked.map((request) => (
            <BookingCard key={request.id} request={request} />
          ))}
        </ul>
      )}

      <p className="pb-6 text-sm text-stone-600">
        Requests still waiting on you are on your{' '}
        <Link href="/vendor/dashboard" className="font-semibold text-clay-500 hover:underline">
          dashboard
        </Link>
        .
      </p>
    </div>
  );
}
