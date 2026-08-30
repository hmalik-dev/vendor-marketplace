import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageTitle } from '@vendor-marketplace/shared';
import { QuoteReview } from '@/components/bookings/quote-review';
import { getOwnBookingRequest } from '@/lib/customer-data';
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
 * The master-detail composition, the status stepper and checkout belong to
 * **#309**, which owns `#68` and is blocked on payments. This deliberately
 * stops at accept.
 */
export default async function BookingRequestPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  await requireRole('customer');
  const { requestId } = await params;
  const request = await getOwnBookingRequest(requestId);

  /*
   * Missing and not-yours arrive here identically, because the API answers a
   * stranger with a 404 rather than a 403 — whether a row exists is not
   * something a stranger gets to learn.
   */
  if (!request) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[660px] px-6 py-10 xl:px-10">
      <Link
        href="/bookings"
        className="mb-5 inline-block rounded-xs text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-clay-400"
      >
        ← Your bookings
      </Link>

      <QuoteReview request={request} />
    </main>
  );
}
