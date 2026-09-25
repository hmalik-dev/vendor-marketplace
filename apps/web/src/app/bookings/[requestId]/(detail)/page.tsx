import type { Metadata } from 'next';
import Link from 'next/link';
import { pageTitle } from '@vendor-marketplace/shared';
import { AcceptedRequest } from '@/components/bookings/accepted-request';
import { QuoteReview } from '@/components/bookings/quote-review';
import { ReportProblem } from '@/components/bookings/report-problem';
import { gateBookingRequest, readBookingForRequest } from '@/lib/booking-route';
import { getRequestConversationId } from '@/lib/customer-data';

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
  /*
   * The customer gate and the 404 for a malformed, missing or not-yours id are
   * `layout.tsx`'s, above the loading boundary (VEN-715). This awaits the same
   * per-request gate, so nothing below runs for a visitor it refuses.
   */
  const { requestId, request } = await gateBookingRequest({ params });

  /*
   * Only for a request that has been accepted: every other status has nothing
   * to pay for, and asking the API would be a round trip whose answer is always
   * `null`. Reading it here rather than inside the component keeps the page the
   * one place that fetches.
   */
  const booking = request.status === 'accepted' ? await readBookingForRequest(requestId) : null;
  /*
   * The thread `Message about this request` opens (frame `47`), read only while
   * there is a quote to talk about — the one state that draws the link.
   */
  const conversationId =
    request.status === 'quoted' ? await getRequestConversationId(requestId) : null;

  return (
    /*
      A plain box, not a second `<main>`. The layout already owns the page's
      one `main#main` landmark (`app/layout.tsx`), so a `<main>` here nested a
      landmark inside itself: screen-reader landmark navigation announced two
      main regions, and any `role=main` locator went ambiguous — Playwright's
      own `main` locator threw a strict-mode violation on this route.
    */
    <div className="mx-auto w-full max-w-[660px] px-6 py-10 xl:px-10">
      <Link
        href="/bookings"
        className="mb-5 inline-block rounded-xs text-sm font-semibold text-clay-500 hover:underline"
      >
        ← My bookings
      </Link>

      {/*
        Which surface this is depends on the status. `quoted` is a decision the
        customer has not made yet; `accepted` is one they have, and what is left
        is paying for it or calling it off.
      */}
      {request.status === 'accepted' ? (
        <AcceptedRequest request={request} booking={booking} />
      ) : (
        <QuoteReview request={request} conversationId={conversationId} />
      )}

      {/*
        The way into #423's payout hold, and the only one in the product (#425).

        A sibling of the card rather than a control inside it, because
        `AcceptedRequest` is a client component and this decides its window from
        a clock: rendered here it is the *server's* clock, which is the one
        `placeDisputeHold` refuses on. It appears only once there is a booking —
        a request with no payment behind it has no payout to hold.
      */}
      {booking ? (
        <div className="mt-4">
          <ReportProblem booking={booking} vendorName={request.vendor.businessName} />
        </div>
      ) : null}
    </div>
  );
}
