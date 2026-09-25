import { cache } from 'react';
import { toEntries, type BookingEntry } from './booking-entries';
import { getOwnBookingRequests, getOwnBookings } from './customer-data';

/**
 * The customer's bookings hub entries, read once per request.
 *
 * The page draws them and the sidebar's count is their length, so the two must
 * come from one read: summing the lists separately is how the count once
 * disagreed between pages (9 on the profile, 7 on the hub). `cache` is what lets
 * the layout's sidebar and the page both ask without fetching twice.
 *
 * Required: a failed read reaches the route's error boundary and its Try again
 * rather than drawing "No bookings yet" for a customer who may have just paid.
 */
export const readOwnBookingEntries = cache(async (): Promise<BookingEntry[]> => {
  const [requests, bookings] = await Promise.all([
    getOwnBookingRequests({ required: true }),
    getOwnBookings({ required: true }),
  ]);

  return toEntries(requests, bookings);
});
