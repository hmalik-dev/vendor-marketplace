'use client';

import {
  DECLINE_REASON_MAX_LENGTH,
  EVENT_TYPE_LABELS,
  LIVE_BOOKING_REQUEST_STATUSES,
  expiryCountdown,
  formatPrice,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { AlertDialog } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FIELD_FOCUS } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import { useApi } from '@/lib/use-api';
import { prePaymentRefundClause } from '@/lib/refund-deadline';
import { formatInstant, useViewerTimeZone } from '@/lib/use-viewer-time-zone';
import { formatEventDate, REQUEST_PRESENTATION } from '@/lib/booking-entries';
import { SettlementNote } from '@/components/bookings/settlement-note';
import { cancellationNarrative } from '@/lib/settlement-copy';
import { wireBookingRequestSchema, type WireBookingRequest } from '@/lib/wire-schemas';

/**
 * What a request that is over says about itself.
 *
 * Plain restatements of the labels the hub already renders, in the past tense.
 * `declined` can be either party, so it stays impersonal.
 *
 * **`cancelled` is not in here**, and deliberately. It used to read "You
 * withdrew this request." — true of the only route that reached this screen
 * while a cancelled *booking* was unreachable by navigation, and false on the
 * two routes #400 added. Its replacement, "This request was cancelled.", was
 * never false and said nothing at all about a booking where money had moved
 * and come back.
 *
 * The three are now told apart from the booking the request produced (#415),
 * so the sentence comes from `cancellationNarrative` rather than from a status
 * lookup that cannot know which of the three this is.
 */
const SETTLED_SENTENCE: Record<string, string> = {
  declined: 'This request was declined.',
  expired: 'This request expired.',
};

export interface QuoteReviewProps {
  request: WireBookingRequest;
  /**
   * The thread this request is negotiated in, which `Message about this
   * request` opens (frame `47`). `null` when it could not be read: the link
   * then opens the inbox.
   */
  conversationId: string | null;
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
export function QuoteReview({ request, conversationId }: QuoteReviewProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const timeZone = useViewerTimeZone();
  const refundClause = prePaymentRefundClause(request.eventDate, (instant) =>
    formatInstant(instant, timeZone),
  );

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
   * cancelled booking's "Canceled" — so this is the existing word for it
   * rather than a new one.
   */
  const awaiting = request.status === 'pending';

  /*
   * **Settled requests reach this component too**, and they are not a third
   * case of the same screen — they are a screen with no decision left on it.
   * The detail page routes everything that is not `accepted` here, so
   * `declined`, `cancelled` and `expired` all land in whichever branch is not
   * `awaiting` and were rendering as a live quote: the vendor's name over
   * "sent a quote", the refund terms, and an enabled `Accept quote` that
   * answers 409.
   *
   * The worst of it was reachable in one press. Withdrawing refreshes, the
   * status becomes `cancelled`, `awaiting` flips false, and the screen the
   * customer is still looking at starts offering to accept a quote that no
   * longer exists.
   *
   * Derived from the state machine rather than listed: a status is live
   * exactly while it still has somewhere to go, which is the same definition
   * the unique indexes and the expiry sweep use.
   */
  const settled = !LIVE_BOOKING_REQUEST_STATUSES.includes(request.status);
  /*
   * Only for a cancellation. A declined or expired request never reached a
   * booking, so it has no money to account for and the narrative would be a
   * paragraph explaining that nothing happened.
   */
  const cancellation =
    request.status === 'cancelled' ? cancellationNarrative(request.settlement, 'customer') : null;
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
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
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
          {settled
            ? request.vendor.businessName
            : awaiting
              ? `Waiting on ${request.vendor.businessName}`
              : `${request.vendor.businessName} sent a quote`}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {[occasion, formatEventDate(request.eventDate), request.eventLocation]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        {cancellation ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-[1.6] text-stone-700">{cancellation.what}</p>
            <SettlementNote money={cancellation.money} />
          </div>
        ) : settled ? (
          <p className="text-sm leading-[1.6] text-stone-700">
            {SETTLED_SENTENCE[request.status] ??
              `This request is ${(REQUEST_PRESENTATION[request.status]?.label ?? request.status).toLowerCase()}.`}
          </p>
        ) : awaiting ? (
          /*
            No price row while there is no price. A "Quoted price" label above
            "No price yet" is a field pretending to be a value — `40-states.md`
            wants the state named, not an empty slot rendered.
          */
          <p className="text-sm leading-[1.6] text-stone-700">
            Your request is with {request.vendor.businessName}. We&apos;ll notify you when they send
            a price. The date isn&apos;t held until you accept a quote, and nothing is charged until
            you pay.
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

        {/*
          `expiresAt` is never cleared when a request settles, so this line
          would keep counting down a deadline on a request that is already
          over — "expires in 5d" under "This request was declined".
        */}
        {countdown && !settled ? (
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
        {awaiting || settled || refundClause === null ? null : (
          <p className="text-[12.5px] leading-[1.55] text-stone-600">
            Accepting holds the date. You are not charged yet, and {refundClause}.
          </p>
        )}

        {error ? (
          <p role="alert" className="text-xs text-error-500">
            {error}
          </p>
        ) : null}

        {/*
          Nothing to decide on a request that is over. Every control here
          answers 409 on a settled row, and an enabled `Accept quote` on a
          declined request is the same defect as the one this screen used to
          show a pending one.

          Not rendered, rather than hidden. A `display: none` button is still
          in the document and still a code path that can be reached — the
          correction is to have no control, not an invisible one.
        */}
        {settled ? null : (
          <div className="flex flex-wrap items-center gap-2.5">
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
                  {/* Frame `47`: what accepting costs, on the button itself. */}
                  {price === null ? 'Accept quote' : `Accept quote — ${formatPrice(price)}`}
                </Button>
                <DeclineQuote
                  requestId={request.id}
                  vendorName={request.vendor.businessName}
                  disabled={busy}
                />
                {/*
                  Scoped to this request's thread, not the vendor's inbox
                  (frame `47`'s "Message stays scoped").
                */}
                <Link
                  href={
                    conversationId === null
                      ? '/messages'
                      : `/messages?conversation=${encodeURIComponent(conversationId)}`
                  }
                  className="ml-2 rounded-xs text-[13px] font-semibold text-clay-600 hover:underline"
                >
                  Message about this request
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

interface DeclineQuoteProps {
  requestId: string;
  vendorName: string;
  disabled: boolean;
}

/** Frame `47b`'s field: the `.inp` box on a card ground, 52px tall. */
const REASON_FIELD = cn(
  'min-h-13 rounded-[10px] border-stone-300 bg-stone-0 px-3.25 py-2.5 text-[13.5px] text-stone-900',
  FIELD_FOCUS,
);

/**
 * Frame `47b`: Decline asks first, and lets the customer say why (VEN-765).
 *
 * It used to decline on the first press, and a declined quote cannot be taken
 * back. `AlertDialog` rather than `Dialog`, as `ConfirmAction` is: no
 * dismiss-by-click-outside, and it is announced as the confirmation it is.
 */
function DeclineQuote({ requestId, vendorName, disabled }: DeclineQuoteProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * `busy` disables the button only after the next render, so a second press
   * in the same tick still reaches `decline`. The ref closes that window, as it
   * does in `ConfirmAction` (VEN-682).
   */
  const inFlight = useRef(false);

  async function decline(): Promise<void> {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError(null);

    const declineReason = reason.trim();

    try {
      await call(`/booking-requests/${requestId}/decline`, {
        schema: wireBookingRequestSchema,
        method: 'POST',
        ...(declineReason === '' ? {} : { body: { declineReason } }),
      });
      setOpen(false);
      router.refresh();
    } catch (failure) {
      // The dialog stays: closing it would leave an unchanged quote and no word why.
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="secondary" disabled={disabled}>
          Decline
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-stone-900/35" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(26.25rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-stone-0 px-6 py-5.5 shadow-[0_18px_50px_rgba(35,32,28,.25)]">
          <AlertDialog.Title className="font-display text-[21px] font-normal text-stone-900">
            Decline this quote?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13px] leading-[1.55] text-stone-700">
            {vendorName} will be told you’ve declined. The request closes.
          </AlertDialog.Description>
          <label
            htmlFor={reasonId}
            className="mb-1.5 block text-label font-semibold tracking-label text-stone-600 uppercase"
          >
            Tell them why{' '}
            <span className="font-medium tracking-normal normal-case">(optional)</span>
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={DECLINE_REASON_MAX_LENGTH}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            className={REASON_FIELD}
          />
          {error ? (
            <p role="alert" className="mt-3 text-xs text-error-500">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2.5">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={busy}>
                Keep the quote
              </Button>
            </AlertDialog.Cancel>
            {/*
              Not `AlertDialog.Action`: that closes on click, before the request
              answers, and would take a failure message with it. Drawn as the
              frame's red outline rather than the `destructive` fill.
            */}
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void decline()}
              className="border-error-200 text-error-500 hover:bg-error-50"
            >
              {busy ? 'Declining…' : 'Decline quote'}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
