import Link from 'next/link';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';

/**
 * The three reasons a checkout can refuse to open that are **not** "there is
 * nothing here".
 *
 * `failed` is a payment that could not be started; the booking is untouched.
 * `not-accepted` is a request the vendor has not answered yet. `closed` is one
 * that was cancelled, declined or expired.
 *
 * The last two both arrive from the API as a single 409, and splitting them is
 * not fussiness: `40-states.md`'s first and third questions get opposite
 * answers. Telling a customer whose request is still live that it "was
 * cancelled, declined or it expired" is the same defect as the 404 this screen
 * replaced, moved one bucket over.
 */
export type CheckoutUnavailableReason = 'failed' | 'not-accepted' | 'closed';

export interface CheckoutUnavailableProps {
  reason: CheckoutUnavailableReason;
  /** The request the customer came from, so the way back is a real link. */
  requestId: string;
  /** Named where the copy addresses them; `null` when the read failed. */
  vendorName: string | null;
}

interface Copy {
  eyebrow: string;
  heading: string;
  body: string;
  /** The money position, stated even though the answer is always "nothing". */
  money: string;
  action: { label: string; href: string };
  secondary: { label: string; href: string } | null;
}

function copyFor(
  reason: CheckoutUnavailableReason,
  requestId: string,
  vendorName: string | null,
): Copy {
  const booking = `/bookings/${requestId}`;
  const vendor = vendorName ?? 'This vendor';

  if (reason === 'closed') {
    return {
      eyebrow: 'Checkout closed',
      heading: "This booking isn't open any more",
      body: "It was cancelled, declined or it expired, so there's nothing left to pay for. Your date isn't being held.",
      money: 'No payment was taken.',
      action: { label: 'Back to this booking', href: booking },
      secondary: { label: 'Browse vendors', href: '/search' },
    };
  }

  if (reason === 'not-accepted') {
    return {
      eyebrow: 'Not payable yet',
      heading: "This request hasn't been accepted yet",
      body: `${vendor} hasn't accepted your request, so there's nothing to pay for yet. You'll hear from us the moment they answer.`,
      money: 'No payment was taken, and your request is still open with them.',
      action: { label: 'Back to this booking', href: booking },
      secondary: { label: 'Browse vendors', href: '/search' },
    };
  }

  return {
    eyebrow: 'Payment not started',
    heading: "We couldn't start this payment",
    /*
     * Deliberately does not name Stripe or quote the upstream error —
     * `web-route-boundaries.md`. It also does not blame the card: nothing has
     * been entered at this point, and 400 here is our own configuration or the
     * amount, never the customer's bank.
     */
    body: "Something on our side stopped the checkout from opening. It isn't your card — nothing was charged and nothing was entered.",
    money: 'No payment was taken, and your date is still held.',
    action: { label: 'Try this payment again', href: `${booking}/checkout` },
    secondary: { label: 'Back to this booking', href: booking },
  };
}

/**
 * What `/bookings/[requestId]/checkout` renders when the intent cannot be
 * opened for any reason other than the booking not existing.
 *
 * This screen is #387. The page used to call `notFound()` here, so a Stripe 400
 * on a live booking answered *"this page isn't here. The link may be old, or a
 * vendor may have taken their listing down. Nothing is wrong with your
 * account."* — every clause of which was false, and the one true thing (their
 * money could not be taken) was the one thing it did not say.
 *
 * It follows frame `16`'s composition rather than frame `21`'s: `21` draws a
 * declined **card** inside a rendered checkout, and here there is no intent, so
 * no summary rail and no amount to put in one.
 */
export function CheckoutUnavailable({
  reason,
  requestId,
  vendorName,
}: CheckoutUnavailableProps): React.ReactElement {
  const copy = copyFor(reason, requestId, vendorName);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span
        aria-hidden="true"
        className="mb-6 flex size-11.5 items-center justify-center rounded-full bg-error-50"
      >
        <span className="size-4.5 rounded-full bg-error-500" />
      </span>

      <p className="font-mono text-label font-medium tracking-[.16em] text-stone-600 uppercase">
        {copy.eyebrow}
      </p>

      <h1 className="mt-3 font-display text-display-lg tracking-[-.015em] text-stone-900">
        {copy.heading}
      </h1>

      <p className="mt-3 max-w-[460px] text-sm leading-[1.65] text-stone-700">{copy.body}</p>

      {/* Sage because the money position is settled, not because it is good news. */}
      <Banner status="settled" className="mt-5.5 text-left">
        {copy.money}
      </Banner>

      <div className="mt-6.5 flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary">
          {/*
            A link, not a client-side retry: the intent is opened while the page
            renders on the server, so navigating to the same URL *is* the retry
            and there is no state on this screen worth preserving across it.
          */}
          <Link href={copy.action.href}>{copy.action.label}</Link>
        </Button>
        {copy.secondary ? (
          <Button asChild variant="secondary">
            <Link href={copy.secondary.href}>{copy.secondary.label}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
