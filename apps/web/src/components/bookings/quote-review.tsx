'use client';

import {
  EVENT_TYPE_LABELS,
  FULL_REFUND_CUTOFF_HOURS,
  expiryCountdown,
  formatPrice,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { wireBookingRequestSchema, type WireBookingRequest } from '@/lib/wire-schemas';

export interface QuoteReviewProps {
  request: WireBookingRequest;
}

/**
 * Where a customer acts on a quote.
 *
 * There was nowhere. `Review quote` — on the bookings hub, in its rail, and in
 * the customer's own `request_quoted` notification, which promised "open the
 * request to see the price and accept it" — all pointed at the vendor's public
 * storefront, whose only controls are `Request booking` and `Send a message`.
 * The API had supported accept and decline the whole time; nothing in the
 * product reached them, so a quoted request was a dead end for the one person
 * it was waiting on.
 *
 * `20-customer-bookings-hub.md` specifies the surface — status, price, the
 * cancellation terms in plain language, and the contextual pair "Quoted →
 * Review quote + Decline". It carries **no checkout**: paying is #10's, and
 * `Accepted → Pay now` is the state this hands over to.
 */
export function QuoteReview({ request }: QuoteReviewProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const price = request.quotedPriceCents ?? request.finalPriceCents;
  const countdown = expiryCountdown(request.expiresAt, new Date());

  /*
   * A request the vendor has not answered yet. It reaches this component too —
   * the detail page routes everything that is not `accepted` here — and it was
   * being told "<vendor> sent a quote" above a price of "No price yet", beside
   * an `Accept quote` that could not be pressed and a `Decline` that answered
   * 403. Three of the four things on the screen were false.
   *
   * What it actually has is one action, and the state machine already allows
   * it: `pending -> cancelled`. The product calls that **withdrawing** — the
   * hub renders a cancelled request as "Withdrawn", separately from a
   * cancelled booking's "Cancelled" — so this is the existing word for it
   * rather than a new one.
   */
  const awaiting = request.status === 'pending';
  const occasion = request.eventType
    ? (EVENT_TYPE_LABELS[request.eventType as keyof typeof EVENT_TYPE_LABELS] ?? request.eventType)
    : null;

  async function act(action: 'accept' | 'decline' | 'cancel'): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/booking-requests/${request.id}/${action}`, {
        schema: wireBookingRequestSchema,
        method: 'POST',
      });
      // Re-read from the server rather than patching locally: the vendor may
      // have withdrawn, or the request may have expired, while this was open.
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="quote-heading"
      className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_2px_12px_rgba(35,32,28,.07)]"
    >
      <div className="border-b border-stone-200 px-6 py-5">
        <h1 id="quote-heading" className="font-display text-[26px] text-stone-900">
          {awaiting
            ? `Waiting on ${request.vendor.businessName}`
            : `${request.vendor.businessName} sent a quote`}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {[occasion, request.eventDate, request.eventLocation].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        {awaiting ? (
          /*
            No price row while there is no price. A "Quoted price" label above
            "No price yet" is a field pretending to be a value — `40-states.md`
            wants the state named, not an empty slot rendered.
          */
          <p className="text-sm leading-[1.6] text-stone-700">
            Your request is with {request.vendor.businessName}. They&apos;ll send a price, and
            you&apos;ll get a notification the moment they do. Nothing is charged and the date
            isn&apos;t held until you accept a quote.
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] text-stone-600">Quoted price</span>
            {/*
              The number is the vendor's, read back from the row. Nothing here
              computes a total or a fee — the customer's price is the quoted price
              and that is the whole of the arrangement on their side.
            */}
            <span className="font-display text-[36px] text-stone-900">
              {price === null ? 'No price yet' : formatPrice(price)}
            </span>
          </div>
        )}

        {request.quoteNote ? (
          <p className="text-sm leading-[1.6] text-stone-700">{request.quoteNote}</p>
        ) : null}

        {countdown ? (
          <p className="text-[12.5px] text-stone-600">
            {awaiting ? 'This request' : 'This quote'}{' '}
            {countdown === 'expired' ? 'has expired' : countdown}.
          </p>
        ) : null}

        {/*
          The terms before the click, not after it — the cancellation policy is
          the thing a customer most needs stated before they commit, and
          `20-customer-bookings-hub.md` puts it on this surface in plain
          language rather than behind a link.
        */}
        {awaiting ? null : (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            Accepting holds the date. You are not charged yet, and a full refund applies if you
            cancel at least {FULL_REFUND_CUTOFF_HOURS} hours before the event.
          </p>
        )}

        {error ? (
          <p role="alert" className="text-xs text-error-500">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {awaiting ? (
            /*
              One action, and it is destructive, so it takes a second press
              rather than a dialog — the same shape `AcceptedRequest` uses for
              cancelling a paid booking. Nothing to state above it about money:
              an unanswered request has taken none.
            */
            confirming ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act('cancel')}
                >
                  {busy ? 'Withdrawing…' : 'Yes, withdraw it'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  Keep waiting
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
                Withdraw request
              </Button>
            )
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                disabled={busy || price === null}
                onClick={() => void act('accept')}
              >
                Accept quote
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void act('decline')}
              >
                Decline
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
