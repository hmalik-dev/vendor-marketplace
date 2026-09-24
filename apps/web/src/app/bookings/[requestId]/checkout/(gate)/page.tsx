import type { Metadata } from 'next';
import { expiryCountdown, pageTitle } from '@vendor-marketplace/shared';
import { CheckoutScreen } from '@/components/checkout/checkout-screen';
import {
  CheckoutUnavailable,
  type CheckoutUnavailableReason,
} from '@/components/checkout/checkout-unavailable';
import { acceptedRequestId, openCheckoutOnce, readBookingRequest } from '@/lib/booking-route';
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
  /*
   * The customer gate, the 404 for an id that cannot exist or a request that
   * does not (#387: every other failure is a screen below), and the redirect
   * for an already-paid request live in `layout.tsx` beside this file, above the
   * loading boundary (VEN-715). `openCheckoutOnce` is the layout's own call,
   * cached, so the payment intent is opened once.
   */
  const requestId = await acceptedRequestId({ params });
  const outcome = await openCheckoutOnce(requestId);

  if (outcome.state === 'not-found') {
    throw new Error('Booking request vanished between its layout and its page');
  }

  return outcome.state === 'ready' ? (
    <CheckoutScreen checkout={outcome.checkout} requestId={requestId} />
  ) : (
    await unavailableScreen(outcome.state, requestId)
  );
}

function paymentDeadlineWords(expiresAt: Date | null): string | null {
  const words = expiryCountdown(expiresAt);

  return words === 'expired' ? null : words;
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
  state:
    | 'not-payable'
    | 'vendor-unavailable'
    | 'vendor-paused'
    | 'vendor-closed'
    | 'failed'
    | 'paused'
    | 'over-cap',
  requestId: string,
): Promise<React.ReactElement> {
  if (state === 'failed' || state === 'paused' || state === 'over-cap') {
    return <CheckoutUnavailable reason={state} requestId={requestId} vendorName={null} />;
  }

  /*
   * The read is allowed to fail, but not silently. It carries #390's 8s
   * server-side deadline, and letting a timeout throw here would replace a good
   * error screen with the 500 boundary — on the one path whose entire job is to
   * explain a failure well. The customer still gets an honest screen; the
   * reason it was the vaguer of the two goes to the log.
   */
  const request = await readBookingRequest(requestId).catch((error: unknown) => {
    reportSwallowedError('checkout: reading the request to explain a refusal', error);
    return null;
  });
  const notAccepted = request?.status === 'pending' || request?.status === 'quoted';
  let reason: CheckoutUnavailableReason = notAccepted ? 'not-accepted' : 'closed';

  if (state === 'vendor-unavailable' || state === 'vendor-paused' || state === 'vendor-closed') {
    reason = state;
  }

  return (
    <CheckoutUnavailable
      reason={reason}
      requestId={requestId}
      vendorName={request?.vendor.businessName ?? null}
      deadline={state === 'vendor-paused' ? paymentDeadlineWords(request?.expiresAt ?? null) : null}
    />
  );
}
