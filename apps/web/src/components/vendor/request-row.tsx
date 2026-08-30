'use client';

import {
  EVENT_TYPE_LABELS,
  MIN_BOOKING_AMOUNT_CENTS,
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

/** "expires in 42h" while it is hours away, then in whole days. */
function expiryPhrase(expiresAt: Date | null, now: Date): string {
  if (!expiresAt) {
    return 'no deadline';
  }

  const hours = Math.ceil((expiresAt.getTime() - now.getTime()) / 3_600_000);

  if (hours <= 0) {
    return 'expired';
  }

  return hours <= 48 ? `expires in ${hours}h` : `expires in ${Math.ceil(hours / 24)}d`;
}

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
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const quoteCents = Math.round(Number.parseFloat(amount) * 100);
  const quoteValid = Number.isFinite(quoteCents) && quoteCents >= MIN_BOOKING_AMOUNT_CENTS;

  return (
    <li
      className={cn(
        'rounded-[14px] bg-stone-0 px-4 py-3.5 shadow-sm',
        isFirst && 'shadow-[inset_3px_0_0_var(--color-clay-400),0_2px_10px_rgba(35,32,28,.06)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={customerName} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.25">
            <span className="text-md font-semibold text-stone-900">{customerName}</span>
            <StatusPill tone={isFirst ? 'needsYou' : 'pending'}>
              {isFirst ? 'Needs you' : 'New'}
            </StatusPill>
          </div>
          <p className="mt-0.75 truncate text-sm text-stone-700">{factsLine(request)}</p>
        </div>

        <div className="mr-1.5 text-right">
          <p className="font-display text-[20px] text-stone-900">
            {request.finalPriceCents === null ? '—' : formatPrice(request.finalPriceCents)}
          </p>
          <p className="text-xs text-stone-600">
            {request.finalPriceCents === null
              ? 'quote needed'
              : expiryPhrase(request.expiresAt, new Date())}
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
            /*
              A package request is priced already and its lock is immutable, so
              there is nothing here to quote — the vendor's route out of a price
              they no longer want to honour is to decline.
            */
            title={isPackage ? 'This request is already priced by its package' : undefined}
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
          {amount !== '' && !quoteValid ? (
            <span className="text-xs text-error-500">
              The minimum booking is {formatPrice(MIN_BOOKING_AMOUNT_CENTS)}.
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
