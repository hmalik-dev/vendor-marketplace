'use client';

import {
  EVENT_TYPE_LABELS,
  ERROR_CODES,
  MAX_PACKAGE_PRICE_CENTS,
  MIN_BOOKING_AMOUNT_CENTS,
  expiryCountdown,
  formatPrice,
  type EventType,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { wireBookingRequestSchema, type WireBookingRequest } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';

const ROW_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * What the vendor is shown when a transition fails.
 *
 * A schema rejection is deliberately **not** passed through. The API answers a
 * malformed body with its own `Request validation failed`, which named nothing
 * the vendor could act on and is an upstream implementation detail besides —
 * the same class as #72. The client already refuses both bounds before sending,
 * so reaching this branch means the two disagreed, and the honest thing is to
 * state the rule rather than echo the framework.
 *
 * Every other `AppError` is written for the reader — "that date is already
 * booked", "this request has expired" — and those are passed through unchanged,
 * because the row is exactly where they belong.
 */
function vendorFacingError(failure: unknown): string {
  if (!(failure instanceof ApiClientError)) {
    return 'That did not reach us. Check your connection and try again.';
  }

  if (failure.code === ERROR_CODES.VALIDATION_ERROR) {
    return `Enter a price between ${formatPrice(MIN_BOOKING_AMOUNT_CENTS)} and ${formatPrice(MAX_PACKAGE_PRICE_CENTS)}.`;
  }

  return failure.message;
}

/*
 * The countdown moved to `expiryCountdown` in the shared package. This one
 * counted hours below 48 where the customer's card counted whole days, so the
 * same row read "expires in 60h" to the vendor and "expires in 3d" to the
 * customer. It also invented "no deadline" for a null, where the shared one
 * returns null and the caller renders nothing.
 */

/**
 * "Wedding · Sun Jun 14 · Barr Mansion · 120 guests · Full day coverage"
 *
 * No comma after the weekday: the facts line is already comma-free and frame
 * `08` writes it that way, so the separator stays the middot throughout.
 */
function factsLine(request: WireBookingRequest): string {
  return [
    request.eventType
      ? (EVENT_TYPE_LABELS[request.eventType as EventType] ?? request.eventType)
      : null,
    ROW_DATE.format(new Date(`${request.eventDate}T00:00:00Z`)).replace(',', ''),
    request.eventLocation,
    request.guestCount === null ? null : `${request.guestCount} guests`,
    request.package ? request.package.name : 'Custom request',
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface RequestRowProps {
  request: WireBookingRequest;
  /** The topmost row is the one waiting longest, and is marked as such. */
  isFirst: boolean;
}

/**
 * One incoming request, actionable without leaving the screen.
 *
 * **Accepting must not require opening the request** — that is the whole point
 * of the row, and the reason the quote field opens inline rather than
 * navigating. A package request already carries a price, so it can be accepted
 * outright; a custom one has nothing to accept until a number exists, so its
 * primary action is the quote.
 */
export function RequestRow({ request, isFirst }: RequestRowProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();

  const [quoting, setQuoting] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * Decline is the one action on this row that cannot be taken back: the
   * lifecycle refuses `declined -> accepted`, and the customer has already been
   * told. The 409 that enforces that is correct and stays; the missing step was
   * asking first, and saying plainly that there is no undo.
   */
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  /*
   * Where focus goes when the confirmation closes. Radix restores focus to its
   * own `DialogTrigger`, and this dialog is opened from a plain button under
   * controlled `open` instead, so without this focus lands on `<body>` — a
   * keyboard user who backs out of the dialog is returned to the top of the
   * document and has to tab all the way back to the row they were on.
   */
  const declineRef = useRef<HTMLButtonElement>(null);

  const isPackage = request.package !== null;

  /*
   * "Priya N." — the first name and one initial the API sends. Never the id,
   * and never the full name: that arrives with acceptance.
   */
  const customerName =
    [
      request.customer.firstName,
      request.customer.lastInitial ? `${request.customer.lastInitial}.` : null,
    ]
      .filter(Boolean)
      .join(' ') || 'A customer';

  async function act(path: string, body?: unknown): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/booking-requests/${request.id}/${path}`, {
        schema: wireBookingRequestSchema,
        method: 'POST',
        ...(body === undefined ? {} : { body }),
      });

      // Refreshes the row from the server rather than patching it locally, so
      // an expiry or a conflict that happened meanwhile shows up too.
      router.refresh();
    } catch (failure) {
      /*
       * Inline on the row, never a toast: the error is about *this* request —
       * a date booked out from under it, or a window that closed — and a toast
       * would float away from the row it belongs to.
       */
      setError(vendorFacingError(failure));
    } finally {
      setBusy(false);
    }
  }

  /*
   * Both bounds, each with its own sentence.
   *
   * They used to fail in opposite and equally unhelpful ways: below the minimum
   * the button simply went inert with no network request and no message, while
   * above the maximum the request went out and the vendor was shown the API's
   * own `Request validation failed`. Neither told them what number to type. The
   * bound is the same one `priceCentsSchema` enforces, so the client and the
   * server refuse the same values for the same stated reason.
   */
  const quoteCents = Math.round(Number.parseFloat(amount) * 100);
  const quoteEntered = amount.trim() !== '' && Number.isFinite(quoteCents);
  const quoteIssue: string | null = !quoteEntered
    ? null
    : quoteCents < MIN_BOOKING_AMOUNT_CENTS
      ? `The minimum booking is ${formatPrice(MIN_BOOKING_AMOUNT_CENTS)}.`
      : quoteCents > MAX_PACKAGE_PRICE_CENTS
        ? `The most you can quote is ${formatPrice(MAX_PACKAGE_PRICE_CENTS)}.`
        : null;
  const quoteValid = quoteEntered && quoteIssue === null;

  return (
    <li
      className={cn(
        // `13px` radius on `13px 15px` at 1024 (`27`), `14px` on `14px 16px` at
        // 1440 (`08`).
        'rounded-[13px] bg-stone-0 px-3.75 py-3.25 shadow-sm min-[90rem]:rounded-[14px] min-[90rem]:px-4 min-[90rem]:py-3.5',
        isFirst && 'shadow-[inset_3px_0_0_var(--color-clay-400),0_2px_10px_rgba(35,32,28,.06)]',
      )}
    >
      {/*
        Frame `08`'s wide row at 1440; frame `27 Vendor dashboard — 1024`'s
        stacked card below it. At 1024 the requests column is 423px, and the
        four-part row compressed the event facts to the point of truncating the
        venue — "Barr Mansion, Austi…" — which is the one part of the line the
        vendor needs to recognise the booking. Identity takes the full width
        there and the price and the actions share the line under it.
      */}
      <div className="flex flex-wrap items-center gap-3 min-[90rem]:gap-4">
        <div className="flex min-w-0 basis-full items-center gap-3 min-[90rem]:flex-1 min-[90rem]:basis-0 min-[90rem]:gap-4">
          <Avatar name={customerName} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.25">
              <span className="text-md font-semibold text-stone-900">{customerName}</span>
              <StatusPill tone={isFirst ? 'needsYou' : 'pending'}>
                {isFirst ? 'Needs you' : 'New'}
              </StatusPill>
            </div>
            <p className="mt-0.75 text-sm text-stone-700 min-[90rem]:truncate">
              {factsLine(request)}
            </p>
          </div>
        </div>

        {/* Left of the actions below 1440, right-aligned beside them at 1440. */}
        <div className="mr-auto text-left min-[90rem]:mr-1.5 min-[90rem]:text-right">
          <p className="font-display text-[20px] text-stone-900">
            {request.finalPriceCents === null ? '—' : formatPrice(request.finalPriceCents)}
          </p>
          <p className="text-xs text-stone-600">
            {request.finalPriceCents === null
              ? 'quote needed'
              : expiryCountdown(request.expiresAt, new Date())}
          </p>
        </div>

        <div className="flex gap-2">
          {isPackage ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void act('accept')}
            >
              Accept
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || isPackage}
            onClick={() => setQuoting((open) => !open)}
            aria-describedby={isPackage ? `quote-locked-${request.id}` : undefined}
          >
            Send quote
          </Button>
          <Button
            ref={declineRef}
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmingDecline(true)}
          >
            Decline
          </Button>
        </div>
      </div>

      {/*
        The reason `Send quote` is inert, as visible copy rather than a native
        `title`. A tooltip is not an explanation: it never appears on a touch
        device, it is not announced, and it does not appear at all on a disabled
        control in several browsers — so the vendor met a dead button and no
        account of why.
      */}
      {isPackage ? (
        <p id={`quote-locked-${request.id}`} className="mt-2.5 text-xs text-stone-600">
          Priced by its package, so the amount is fixed. Decline if you cannot honour it.
        </p>
      ) : null}

      {quoting && !isPackage ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
          <label htmlFor={`quote-${request.id}`} className="text-sm text-stone-700">
            Your price
          </label>
          <Input
            id={`quote-${request.id}`}
            type="number"
            inputMode="decimal"
            min={MIN_BOOKING_AMOUNT_CENTS / 100}
            // Stated so the browser can help, and so the ceiling is discoverable
            // before the vendor types past it rather than only after.
            max={MAX_PACKAGE_PRICE_CENTS / 100}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="3840"
            className="h-9 w-32 rounded-lg border-stone-300 bg-stone-150"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || !quoteValid}
            onClick={() => void act('quote', { quotedPriceCents: quoteCents })}
          >
            Send
          </Button>
          {quoteIssue ? (
            <span role="alert" className="text-xs text-error-500">
              {quoteIssue}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2.5 text-xs text-error-500">
          {error}
        </p>
      ) : null}

      <Dialog
        open={confirmingDecline}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingDecline(false);
          }
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            // Escape, the overlay and "Keep it open" all land here. Taking the
            // default away and focusing explicitly is what puts a keyboard user
            // back on the control they opened this from.
            event.preventDefault();
            declineRef.current?.focus();
          }}
        >
          <DialogHeader>
            {/*
              Names the customer and the date, because the vendor is confirming
              a specific commitment and the dashboard may be showing four rows
              that look alike.
            */}
            <DialogTitle>Decline {customerName}&rsquo;s request?</DialogTitle>
            <DialogDescription>
              {declineConsequence(request)} You can&rsquo;t undo this or accept the request
              afterwards. If you&rsquo;re unsure, send a quote or message them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmingDecline(false)}
            >
              Keep it open
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmingDecline(false);
                void act('decline');
              }}
            >
              Decline it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** "They asked about Sun Jun 14, and will be told the date is free again." */
function declineConsequence(request: WireBookingRequest): string {
  const date = ROW_DATE.format(new Date(`${request.eventDate}T00:00:00Z`)).replace(',', '');

  return `They asked about ${date}, and will be told the date is free again.`;
}
