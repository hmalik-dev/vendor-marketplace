'use client';

import {
  CURRENT_REFUND_TERMS,
  EVENT_TYPE_LABELS,
  calculateRefund,
  expiryCountdown,
  formatPrice,
  isUniversallyFutureDate,
  refundBoundaries,
  refundSchedule,
} from '@vendor-marketplace/shared';
import type { RefundBoundaries } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import { formatEventDate } from '@/lib/booking-entries';
import { useApi } from '@/lib/use-api';
import { prePaymentRefundClause } from '@/lib/refund-deadline';
import { formatInstant, useViewerTimeZone } from '@/lib/use-viewer-time-zone';
import { cancelledBookingWireSchema } from '@/lib/wire-schemas';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

export interface AcceptedRequestProps {
  request: WireBookingRequest;
  /** The booking, once payment has landed. `null` means "not paid yet". */
  booking: WireBooking | null;
}

function pulledVendorMessage(request: WireBookingRequest): string | null {
  const { availability, businessName } = request.vendor;

  if (availability === 'closed') {
    return `${businessName} is no longer taking bookings, so this can't be paid for.`;
  }
  if (availability !== 'paused') {
    return null;
  }

  const deadline = expiryCountdown(request.expiresAt, new Date());
  const deadlineSentence = deadline && deadline !== 'expired' ? ` Your booking ${deadline}.` : '';

  return `${businessName} isn't taking bookings right now. Check back later.${deadlineSentence}`;
}

/** The refund line for a paid, cancellable booking, given today's quote and boundaries. */
function cancelWindowMessage(
  quote: ReturnType<typeof calculateRefund> | null,
  lateRefundCents: number | null,
  boundaries: RefundBoundaries,
  totalAmountCents: number,
  at: (iso: string) => string,
): string {
  if (!quote?.isFullRefund) {
    return `Canceling now refunds ${formatPrice(quote?.refundCents ?? 0)} of ${formatPrice(totalAmountCents)}. Online cancellation closes ${at(boundaries.onlineCancellationClosesAt)}.`;
  }

  const lateNote =
    lateRefundCents === null
      ? ''
      : ` After that, until ${at(boundaries.onlineCancellationClosesAt)}, canceling refunds ${formatPrice(lateRefundCents)}.`;

  return `Cancel until ${at(boundaries.fullRefundEndsAt)} and you're refunded in full — ${formatPrice(quote.refundCents)}.${lateNote}`;
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
  const timeZone = useViewerTimeZone();

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
  const quote = booking
    ? calculateRefund(booking.totalAmountCents, booking.eventDate, booking)
    : null;

  /*
   * The API refuses a cancellation once the event has started anywhere or the
   * vendor has been paid — the same two refusals as `placeDisputeHold` — so the
   * control is not offered past that point. The refund line goes with it: past
   * the event `calculateRefund` floors at the half tier, a figure nobody is
   * owed. `ReportProblem`, beside this card, is the way forward.
   */
  const cancellable =
    booking !== null && isUniversallyFutureDate(booking.eventDate) && !booking.payoutReleasedAt;

  /*
   * VEN-615: the deadlines as instants in the viewer's zone, from the same
   * schedule checkout draws. "More than 48 hours before the event" read as
   * the customer's own evening and overstated the full window by the offset.
   * Before payment there is no booking yet, so today's terms apply.
   */
  const boundaries = refundBoundaries(
    booking?.eventDate ?? request.eventDate,
    booking ?? CURRENT_REFUND_TERMS,
  );
  const lateRefundCents = booking
    ? (refundSchedule(booking.totalAmountCents, booking.eventDate, booking)?.find(
        (row) => row.kind === 'late',
      )?.refundCents ?? null)
    : null;
  const at = (iso: string): string => formatInstant(new Date(iso), timeZone);
  const prePaymentClause = prePaymentRefundClause(request.eventDate, (instant) =>
    formatInstant(instant, timeZone),
  );

  async function cancel(): Promise<void> {
    if (!booking) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await call(`/customer/bookings/${booking.id}/cancel`, {
        method: 'PUT',
        body: { expectedRefundCents: quote?.refundCents },
        schema: cancelledBookingWireSchema,
      });
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      /*
       * Refreshed whichever way it went (#405). A cancel that the server
       * carried out but whose response this client could not parse — a schema
       * drift, say — has already issued the refund and cancelled the row; not
       * re-reading left the customer looking at a live booking and a `Cancel`
       * button for something that no longer exists.
       */
      router.refresh();
      setBusy(false);
      setConfirming(false);
    }
  }

  /*
   * A vendor who cannot currently be paid (VEN-559): explained here rather than
   * left for the customer to learn by clicking through to a refusal. A pause
   * names the running deadline; a closure is permanent and says so.
   */
  const pulled = booking === null ? pulledVendorMessage(request) : null;

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
          {[occasion, formatEventDate(request.eventDate), request.eventLocation]
            .filter(Boolean)
            .join(' · ')}
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

        {booking && !cancellable ? (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            This booking can no longer be canceled here. If something went wrong, report a problem
            below.
          </p>
        ) : booking && boundaries ? (
          <>
            <p className="text-[12.5px] leading-[1.55] text-stone-600">
              {cancelWindowMessage(
                quote,
                lateRefundCents,
                boundaries,
                booking.totalAmountCents,
                at,
              )}
            </p>
            <p className="text-[12.5px] leading-[1.55] text-stone-600">
              If {request.vendor.businessName} cancels, you&apos;re refunded in full.
            </p>
          </>
        ) : pulled !== null || prePaymentClause === null ? null : (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            The date is held. Paying now confirms it — {prePaymentClause}.
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
              {!cancellable ? null : confirming ? (
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
                      ? 'Canceling…'
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
          ) : pulled === null ? (
            <Button asChild variant="primary" disabled={price === null}>
              <Link href={`/bookings/${request.id}/checkout`} prefetch={false}>
                Pay {price === null ? 'now' : formatPrice(price)}
              </Link>
            </Button>
          ) : (
            <p role="status" className="text-[12.5px] leading-[1.55] text-stone-700">
              {pulled}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
