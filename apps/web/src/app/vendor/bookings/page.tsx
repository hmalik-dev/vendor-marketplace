import { pageTitle, todayDateString } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookingCard } from '@/components/vendor/booking-card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireRole } from '@/lib/current-user';
import { getOwnBookingRequests } from '@/lib/vendor-requests';
import { getOwnBookings } from '@/lib/customer-data';
import { getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = {
  title: pageTitle('Bookings'),
  // The one surface that prints a customer's contact details. `robots.ts`
  // already disallows `/vendor/`; this is the belt to that pair of braces.
  robots: { index: false, follow: false },
};

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

  /*
   * `throw`, not the dashboard's silent `[]`. The list is this page's entire
   * subject, so a failed read must not render as "nothing booked" at a vendor
   * who has four weddings.
   */
  const requests = await getOwnBookingRequests({ onFailure: 'throw' });
  /*
   * `/bookings` is scoped by the caller's role, so this is the vendor's own
   * side of the same endpoint the customer hub reads. Degrading to `[]` is
   * right here and not for the list above: a missing booking row costs the
   * `Mark complete` control, while a missing request would claim the vendor has
   * nothing booked.
   */
  const bookings = await getOwnBookings();
  const bookingByRequest = new Map(bookings.map((booking) => [booking.requestId, booking]));
  const today = todayDateString();

  /*
   * `accepted` is terminal, so a booking stays accepted after the event has
   * happened. Split on the date rather than listing all of them: what the
   * vendor opens this page for is the next thing they have to turn up to, and
   * a year in, an undivided list leads with last spring.
   */
  const accepted = requests.filter((request) => request.status === 'accepted');
  const upcoming = accepted
    .filter((request) => request.eventDate >= today)
    .sort((left, right) => left.eventDate.localeCompare(right.eventDate));
  const past = accepted
    .filter((request) => request.eventDate < today)
    // Most recent first: the further back it is, the less it is wanted.
    .sort((left, right) => right.eventDate.localeCompare(left.eventDate));

  return (
    <div data-app-shell className="w-full px-4 pt-5.5 sm:px-6 lg:px-0 lg:pl-6">
      <h1 className="display-heading mb-1 text-[26px] text-stone-900">
        {upcoming.length === 0
          ? 'Nothing booked yet'
          : `You have ${upcoming.length} ${upcoming.length === 1 ? 'booking' : 'bookings'} coming up`}
      </h1>
      <p className="mb-4 text-sm text-stone-700">
        Every request you&rsquo;ve accepted, and how to reach the customer.
      </p>

      {upcoming.length === 0 ? (
        <EmptyState
          panel
          headline="No bookings yet"
          description="A request becomes a booking the moment you accept it. Accepted requests show up here with the customer's contact details."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {upcoming.map((request) => (
            <BookingCard
              key={request.id}
              request={request}
              booking={bookingByRequest.get(request.id) ?? null}
              today={today}
            />
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <>
          <h2 className="mt-6 mb-2.5 font-display text-[21px] text-stone-900">Past events</h2>
          <ul className="flex flex-col gap-2.5">
            {past.map((request) => (
              <BookingCard
                key={request.id}
                request={request}
                booking={bookingByRequest.get(request.id) ?? null}
                today={today}
              />
            ))}
          </ul>
        </>
      ) : null}

      <p className="py-6 text-sm text-stone-600">
        Requests still waiting on you are on your{' '}
        <Link href="/vendor/dashboard" className="font-semibold text-clay-500 hover:underline">
          dashboard
        </Link>
        .
      </p>
    </div>
  );
}
