import Link from 'next/link';
import { BOOKINGS_PAUSED_NOTICE } from '@vendor-marketplace/shared';
import { Banner } from '@/components/ui/banner';
import { RetryLink } from '@/components/checkout/retry-link';
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
export type CheckoutUnavailableReason =
  | 'failed'
  | 'not-accepted'
  | 'closed'
  | 'paused'
  | 'over-cap'
  | 'vendor-unavailable'
  | 'vendor-paused'
  | 'vendor-closed';

export interface CheckoutUnavailableProps {
  reason: CheckoutUnavailableReason;
  /** The request the customer came from, so the way back is a real link. */
  requestId: string;
  /** Named where the copy addresses them; `null` when the read failed. */
  vendorName: string | null;
  /**
   * The payment deadline as `expiryCountdown` words it ("expires in 3d"), so the
   * temporary states can say the clock is running. `null` when there is none.
   */
  deadline?: string | null;
}

interface Copy {
  eyebrow: string;
  heading: string;
  body: string;
  /**
   * The money position. "Nothing was taken" for the two reasons where that is
   * true, and a claim-free sentence for `closed`, where it is not (#400).
   */
  money: string;
  action: { label: string; href: string };
  secondary: { label: string; href: string } | null;
}

function copyFor(
  reason: CheckoutUnavailableReason,
  requestId: string,
  vendorName: string | null,
  deadline: string | null,
): Copy {
  const booking = `/bookings/${requestId}`;
  const vendor = vendorName ?? 'This vendor';

  if (reason === 'closed') {
    return {
      eyebrow: 'Checkout closed',
      heading: "This booking isn't open any more",
      body: "It was cancelled, declined or it expired, so there's nothing left to pay for. Your date isn't being held.",
      /*
       * Not "No payment was taken." — #400 made this screen reachable by a
       * customer who *did* pay. Cancelling a confirmed booking now settles the
       * parent request, so this checkout answers `closed` where it used to
       * redirect to the confirmation, and the old sentence told someone who had
       * paid $1,450 and been refunded that no payment was taken. This one is
       * true of every closed booking — refunded in full, refunded by half, or
       * never paid at all — and asserts nothing about money that moved. What
       * that money actually did belongs on a surface that knows it (#415).
       */
      money: 'Nothing is owed on this booking.',
      action: { label: 'Back to this booking', href: booking },
      secondary: { label: 'Browse vendors', href: '/search' },
    };
  }

  /*
   * The admin paused checkout (VEN-404). The ticket's sentence verbatim, and
   * the retry is the same link as `failed`'s: the page re-opens checkout as it
   * renders, so it works again the moment the switch is off.
   */
  if (reason === 'paused') {
    return {
      eyebrow: 'Checkout paused',
      heading: 'Payments are paused for a moment',
      body: BOOKINGS_PAUSED_NOTICE,
      money: 'No payment was taken and your booking is still accepted.',
      action: { label: 'Try this payment again', href: `${booking}/checkout` },
      secondary: { label: 'Back to this booking', href: booking },
    };
  }

  /*
   * Over the closed-beta cap (VEN-404), which retrying can never clear — so the
   * action is support rather than a retry link.
   */
  if (reason === 'over-cap') {
    return {
      eyebrow: 'Over the beta limit',
      heading: 'This booking is over our beta limit',
      body: "During the beta we can only take payment up to a set price, and this booking is above it. Contact support and we'll sort it out with you.",
      money: 'No payment was taken and your booking is still accepted.',
      action: { label: 'Contact support', href: '/support' },
      secondary: { label: 'Back to this booking', href: booking },
    };
  }

  /*
   * The API's 402, which covers two things a customer cannot tell apart and
   * cannot act on: the vendor's payout account, or their agreement. Both are
   * the vendor's to fix, both are temporary, and neither is the customer's
   * account — so one message, and the retry is the same link as `failed`'s.
   */
  if (reason === 'vendor-unavailable') {
    return {
      eyebrow: 'Payment unavailable',
      heading: `${vendor} can't take payment right now`,
      body: `${vendor} needs to finish a step on their side before they can accept payment. This is temporary and nothing is wrong with your account. Try again a little later.`,
      money: 'No payment was taken and your booking is still accepted.',
      action: { label: 'Try this payment again', href: `${booking}/checkout` },
      secondary: { label: 'Back to this booking', href: booking },
    };
  }

  /*
   * An unpublished vendor or one on a moderation hold (409 `VENDOR_PAUSED`,
   * VEN-559). Reversible, so it reuses the 402 case's temporary copy and retry
   * link, and names the payment deadline because that clock keeps running.
   */
  if (reason === 'vendor-paused') {
    return {
      eyebrow: 'Payment unavailable',
      heading: `${vendor} isn't taking bookings right now`,
      body: `${vendor} is paused at the moment, so this can't be paid yet. This is temporary and nothing is wrong with your account. Try again a little later.${deadline ? ` Your booking ${deadline}.` : ''}`,
      money: 'No payment was taken and your booking is still accepted.',
      action: { label: 'Try this payment again', href: `${booking}/checkout` },
      secondary: { label: 'Back to this booking', href: booking },
    };
  }

  /*
   * A banned or retired vendor (409 `VENDOR_UNAVAILABLE`, VEN-555). Permanent, so
   * no retry link and no "temporary" or "still accepted" — the API's own wording.
   */
  if (reason === 'vendor-closed') {
    return {
      eyebrow: 'Payment unavailable',
      heading: `${vendor} is no longer taking bookings`,
      body: `${vendor} can't accept this booking any more, so it can't be paid for.`,
      money: 'Nothing can be paid on this booking.',
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
    /*
     * Not "…and your date is still held." — this screen cannot know that.
     * `unavailableScreen` short-circuits to `failed` *without* reading the
     * request, because the two things that produce it are a 400/422 and #390's
     * 8s timeout, and adding a second deadlined read to a screen that has just
     * timed out buys nothing. #400 made that gap reachable: a cancelled booking
     * no longer redirects to the confirmation, so a stalled POST on one renders
     * this screen and promised a refunded customer that a date they had already
     * given up was still theirs.
     *
     * The replacement is the design contract's own sentence for this situation
     * — frame `16`, whose composition this screen already follows, and which
     * `error-screen.tsx` renders verbatim. It is true of every `failed`:
     * `openCheckout` only opens an intent, so a failure there writes nothing
     * and charges nothing.
     */
    money: 'No payment was taken and no booking was changed.',
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
  deadline = null,
}: CheckoutUnavailableProps): React.ReactElement {
  const copy = copyFor(reason, requestId, vendorName, deadline);

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

      <h1 className="mt-3 font-display text-display-error tracking-[-.015em] text-stone-900">
        {copy.heading}
      </h1>

      <p className="mt-3 max-w-[460px] text-cta leading-[1.65] text-stone-700">{copy.body}</p>

      {/* Sage because the money position is settled, not because it is good news. */}
      <Banner status="settled" className="mt-5.5 text-left">
        {copy.money}
      </Banner>

      <div className="mt-6.5 flex flex-wrap justify-center gap-3">
        <Button asChild variant="primary">
          {/*
            A link, not a client-side retry: the intent is opened while the page
            renders on the server, so re-rendering this URL *is* the retry and
            there is no state on this screen worth preserving across it. It is a
            `RetryLink` because a plain `<Link>` to the URL the reader is on is
            answered from the router cache, and the retry would never reach the
            server.
          */}
          <RetryLink href={copy.action.href}>{copy.action.label}</RetryLink>
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
