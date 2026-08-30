'use client';

import {
  EVENT_TYPE_LABELS,
  FULL_REFUND_CUTOFF_HOURS,
  calculateRefund,
  formatPrice,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { cancelledBookingWireSchema } from '@/lib/wire-schemas';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

export interface AcceptedRequestProps {
  request: WireBookingRequest;
  /** The booking, once payment has landed. `null` means "not paid yet". */
  booking: WireBooking | null;
}

/**
 * An accepted request, and the two things a customer does with one: pay for it,
 * or cancel it.
 *
 * `20-customer-bookings-hub.md` names the contextual pair for this status as
 * **Accepted → Pay now**, which `QuoteReview` explicitly handed over rather
 * than building. Once paid, the same surface becomes the place the booking is
 * cancelled from, because the refund the customer gets depends on when they are
 * standing — and that is a sentence, not a policy link.
 */
export function AcceptedRequest({ request, booking }: AcceptedRequestProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const price = request.finalPriceCents ?? request.quotedPriceCents;
  const occasion = request.eventType
    ? (EVENT_TYPE_LABELS[request.eventType as keyof typeof EVENT_TYPE_LABELS] ?? request.eventType)
    : null;

  /*
   * What cancelling right now returns, computed from the same helper the API
   * uses. It is stated before the click rather than after it — a customer who
   * learns the refund is half only from the confirmation has been told too
   * late.
   */
  const quote = booking ? calculateRefund(booking.totalAmountCents, booking.eventDate) : null;

  async function cancel(): Promise<void> {
    if (!booking) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await call(`/customer/bookings/${booking.id}/cancel`, {
        method: 'PUT',
        body: {},
        schema: cancelledBookingWireSchema,
      });
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section
      aria-labelledby="accepted-heading"
      className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_2px_12px_rgba(35,32,28,.07)]"
    >
      <div className="border-b border-stone-200 px-6 py-5">
        <h1 id="accepted-heading" className="font-display text-[26px] text-stone-900">
          {booking
            ? `${request.vendor.businessName} is booked`
            : `${request.vendor.businessName} accepted your request`}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {[occasion, request.eventDate, request.eventLocation].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-stone-600">{booking ? 'Paid' : 'Total today'}</span>
          <span className="font-display text-[36px] text-stone-900">
            {booking
              ? formatPrice(booking.totalAmountCents)
              : price === null
                ? 'No price yet'
                : formatPrice(price)}
          </span>
        </div>

        {booking ? (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            {quote?.isFullRefund
              ? `Cancel more than ${FULL_REFUND_CUTOFF_HOURS} hours before the event and you're refunded in full — ${formatPrice(quote.refundCents)}.`
              : `The event is inside ${FULL_REFUND_CUTOFF_HOURS} hours, so cancelling now refunds ${formatPrice(quote?.refundCents ?? 0)} of ${formatPrice(booking.totalAmountCents)}.`}
          </p>
        ) : (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            The date is held. Paying now confirms it — you&apos;re refunded in full if you cancel at
            least {FULL_REFUND_CUTOFF_HOURS} hours before the event.
          </p>
        )}

        {error ? (
          <p role="alert" className="text-xs text-error-500">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {booking ? (
            <>
              <Button asChild variant="primary">
                <Link href={`/bookings/${request.id}/confirmed`}>View confirmation</Link>
              </Button>
              {confirming ? (
                <>
                  {/*
                    A destructive action gets a second step rather than a
                    dialog: the consequence is already stated above in the
                    refund line, so what is needed is a deliberate second
                    press, not a box repeating it.
                  */}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void cancel()}
                  >
                    {busy
                      ? 'Cancelling…'
                      : `Yes, cancel and refund ${formatPrice(quote?.refundCents ?? 0)}`}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                  >
                    Keep the booking
                  </Button>
                </>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
                  Cancel booking
                </Button>
              )}
            </>
          ) : (
            <Button asChild variant="primary" disabled={price === null}>
              <Link href={`/bookings/${request.id}/checkout`}>
                Pay {price === null ? 'now' : formatPrice(price)}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
