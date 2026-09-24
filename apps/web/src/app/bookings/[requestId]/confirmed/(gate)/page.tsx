import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { BookingConfirmed } from '@/components/bookings/booking-confirmed';
import { acceptedRequest, acceptedRequestId, readBookingForRequest } from '@/lib/booking-route';
import { getOwnConversations } from '@/lib/messaging-data';

export const metadata: Metadata = {
  title: pageTitle('Booking confirmed'),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ requestId: string }>;
}

/**
 * Frame `06`, as a route the customer can come back to.
 *
 * The booking read is also the **reconciliation trigger**: when the webhook has
 * not landed yet, the API asks Stripe directly and books from the answer. So a
 * customer who arrives here the instant their card cleared sees their booking
 * rather than a race they lost, and one whose webhook was dropped entirely gets
 * it by reloading.
 */
export default async function BookingConfirmedPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  /*
   * The 404 and the redirect back to checkout for an unpaid request live in
   * `layout.tsx` beside this file, above the loading boundary (VEN-715).
   */
  const requestId = await acceptedRequestId({ params });
  const [booking, request] = await Promise.all([
    readBookingForRequest(requestId),
    acceptedRequest(requestId),
  ]);

  if (booking === null) {
    throw new Error('Booking vanished between its layout and its page');
  }

  /*
   * The thread with this vendor, so `Message …` has somewhere to go. Read from
   * the customer's own list rather than opened here: this page is a GET, and a
   * navigation that writes a row is how a refresh becomes a side effect.
   */
  const conversations = await getOwnConversations();
  const thread = conversations.find((row) => row.vendorSlug === request.vendor.slug);

  return (
    <BookingConfirmed
      booking={booking}
      vendor={{
        slug: request.vendor.slug,
        businessName: request.vendor.businessName,
        avatarUrl: request.vendor.avatarUrl,
        city: null,
      }}
      conversationId={thread?.id ?? null}
    />
  );
}
