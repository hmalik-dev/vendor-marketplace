import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { pageTitle, uuidSchema } from '@vendor-marketplace/shared';
import { CheckoutScreen } from '@/components/checkout/checkout-screen';
import {
  CheckoutUnavailable,
  type CheckoutUnavailableReason,
} from '@/components/checkout/checkout-unavailable';
import { getBookingForRequest, getOwnBookingRequest, openCheckout } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';
import { reportSwallowedError } from '@/lib/report-error';

export const metadata: Metadata = {
  title: pageTitle('Secure checkout'),
  robots: { index: false, follow: false },
};

/** A live payment intent per visit; nothing here is cacheable. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ requestId: string }>;
}

/**
 * Frame `05`. The screen that takes the money.
 *
 * The shell is **not** the app shell — `14-checkout.md` strips the chrome back
 * to a wordmark and one reassurance line — and that shell is `layout.tsx` in
 * this directory, so the segment's `not-found` and `error` boundaries wear it
 * too. See the note there.
 */
export default async function CheckoutPage({ params }: PageProps): Promise<React.ReactElement> {
  await requireRole('customer');
  const { requestId } = await params;

  /*
   * Parsed before it reaches a query, for the reason `web-route-boundaries.md`
   * gives: this URL is pasteable, and an id the API cannot parse is an
   * identifier that cannot exist — `notFound()`, never the 500 page.
   */
  const parsed = uuidSchema.safeParse(requestId);
  if (!parsed.success) {
    notFound();
  }

  /*
   * Already paid: there is nothing to take. Checked before opening checkout so
   * a customer who reloads the URL after paying lands on their confirmation
   * rather than on a card form for a booking they already hold.
   */
  const existing = await getBookingForRequest(parsed.data);
  if (existing) {
    redirect(`/bookings/${parsed.data}/confirmed`);
  }

  /*
   * Only a request that does not exist reaches `notFound()`. #387: every other
   * failure used to land here too, so an upstream payment error rendered
   * "this page isn't here" over a live booking on a published vendor.
   */
  const outcome = await openCheckout(parsed.data);

  if (outcome.state === 'not-found') {
    notFound();
  }

  return outcome.state === 'ready' ? (
    <CheckoutScreen checkout={outcome.checkout} requestId={parsed.data} />
  ) : (
    await unavailableScreen(outcome.state, parsed.data)
  );
}

/**
 * The screen for a checkout that would not open.
 *
 * The API answers a single 409 for two opposite situations — a request the
 * vendor has not answered yet, and one that was cancelled, declined or has
 * expired — so the request itself is read to tell them apart. Only on the error
 * path, and only for that status: it is a second round trip on a screen that
 * has already failed, and the alternative is telling a customer whose request
 * is very much alive that it was cancelled.
 *
 * A request that cannot be read falls back to `closed`, which is the safer of
 * the two: it promises the customer nothing.
 */
async function unavailableScreen(
  state: 'not-payable' | 'failed',
  requestId: string,
): Promise<React.ReactElement> {
  if (state === 'failed') {
    return <CheckoutUnavailable reason="failed" requestId={requestId} vendorName={null} />;
  }

  /*
   * The read is allowed to fail, but not silently. It carries #390's 8s
   * server-side deadline, and letting a timeout throw here would replace a good
   * error screen with the 500 boundary — on the one path whose entire job is to
   * explain a failure well. The customer still gets an honest screen; the
   * reason it was the vaguer of the two goes to the log.
   */
  const request = await getOwnBookingRequest(requestId).catch((error: unknown) => {
    reportSwallowedError('checkout: reading the request to explain a 409', error);
    return null;
  });
  const reason: CheckoutUnavailableReason =
    request?.status === 'pending' || request?.status === 'quoted' ? 'not-accepted' : 'closed';

  return (
    <CheckoutUnavailable
      reason={reason}
      requestId={requestId}
      vendorName={request?.vendor.businessName ?? null}
    />
  );
}
