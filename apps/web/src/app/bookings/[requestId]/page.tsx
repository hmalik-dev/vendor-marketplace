import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageTitle, uuidSchema } from '@vendor-marketplace/shared';
import { AcceptedRequest } from '@/components/bookings/accepted-request';
import { QuoteReview } from '@/components/bookings/quote-review';
import { getBookingForRequest, getOwnBookingRequest } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your request'),
  robots: { index: false, follow: false },
};

/** Resolves the signed-in customer before rendering, which a build cannot do. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ requestId: string }>;
}

/**
 * One request the customer sent, and the place they act on its quote.
 *
 * `20-customer-bookings-hub.md` draws this as the detail half of a master-detail
 * at >=1280 and as its own page below that. It is built as its own page first
 * because that is the half that has to exist for the flow to work at all — a
 * quoted request had no destination anywhere in the product, so `Review quote`
 * pointed at the vendor's storefront and the customer could not accept.
 *
 * The master-detail composition and the status stepper belong to **#309**.
 * Checkout no longer does: #10 built it, so the `accepted` status now hands off
 * to `AcceptedRequest` — which is the `Accepted → Pay now` pair this file's
 * predecessor named and could not build.
 */
export default async function BookingRequestPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  await requireRole('customer');
  const { requestId } = await params;

  /*
   * Parsed before it reaches a query. `requestId` is attacker-controlled — this
   * URL is the kind people paste to each other — and an id that is not a UUID
   * makes the API answer 400, which is "an identifier that cannot exist" and so
   * `notFound()` rather than the error boundary. Handling it here means the
   * malformed case never reaches the network at all.
   */
  const parsed = uuidSchema.safeParse(requestId);
  if (!parsed.success) {
    notFound();
  }

  const request = await getOwnBookingRequest(parsed.data);

  /*
   * Missing and not-yours arrive here identically, because the API answers a
   * stranger with a 404 rather than a 403 — whether a row exists is not
   * something a stranger gets to learn.
   */
  if (!request) {
    notFound();
  }

  /*
   * Only for a request that has been accepted: every other status has nothing
   * to pay for, and asking the API would be a round trip whose answer is always
   * `null`. Reading it here rather than inside the component keeps the page the
   * one place that fetches.
   */
  const booking = request.status === 'accepted' ? await getBookingForRequest(parsed.data) : null;

  return (
    <main className="mx-auto w-full max-w-[660px] px-6 py-10 xl:px-10">
      <Link
        href="/bookings"
        className="mb-5 inline-block rounded-xs text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-clay-400"
      >
        ← Your bookings
      </Link>

      {/*
        Which surface this is depends on the status. `quoted` is a decision the
        customer has not made yet; `accepted` is one they have, and what is left
        is paying for it or calling it off.
      */}
      {request.status === 'accepted' ? (
        <AcceptedRequest request={request} booking={booking} />
      ) : (
        <QuoteReview request={request} />
      )}
    </main>
  );
}
