import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { pageTitle, uuidSchema } from '@vendor-marketplace/shared';
import { BookingConfirmed } from '@/components/bookings/booking-confirmed';
import { getBookingForRequest, getOwnBookingRequest } from '@/lib/customer-data';
import { getOwnConversations } from '@/lib/messaging-data';
import { requireRole } from '@/lib/current-user';

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
  await requireRole('customer');
  const { requestId } = await params;

  const parsed = uuidSchema.safeParse(requestId);
  if (!parsed.success) {
    notFound();
  }

  const [booking, request] = await Promise.all([
    getBookingForRequest(parsed.data),
    getOwnBookingRequest(parsed.data),
  ]);

  if (!request) {
    notFound();
  }

  /*
   * Not paid yet. Back to checkout rather than a 404 — the customer is one step
   * behind rather than somewhere they should not be, and the destination they
   * wanted is the one they get sent to.
   */
  if (!booking) {
    redirect(`/bookings/${parsed.data}/checkout`);
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
