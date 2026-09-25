import { BookingsSidebar, type BookingsSidebarProps } from '@/components/bookings/bookings-sidebar';
import { isNavigationSignal } from '@/lib/navigation-signal';
import { readOwnBookingEntries } from '@/lib/own-booking-entries';
import { reportSwallowedError } from '@/lib/report-error';

/**
 * The sidebar with its `My bookings` count, read on the server.
 *
 * A failed read costs the number, not the screen: the page beside it asks for
 * the same entries and owns the error boundary, and `/messages` has no reason to
 * fail because a bookings list did. A redirect still goes through.
 */
export async function BookingsSidebarWithCount({
  current,
}: Pick<BookingsSidebarProps, 'current'>): Promise<React.ReactElement> {
  let bookingCount: number | null = null;

  try {
    bookingCount = (await readOwnBookingEntries()).length;
  } catch (error: unknown) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    reportSwallowedError('sidebar: reading the bookings count failed', error);
  }

  return <BookingsSidebar bookingCount={bookingCount} current={current} />;
}
