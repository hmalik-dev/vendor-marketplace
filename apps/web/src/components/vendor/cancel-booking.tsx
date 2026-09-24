'use client';

import {
  formatPrice,
  isUniversallyFutureDate,
  vendorCancellationRefundCents,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import { useApi } from '@/lib/use-api';
import { cancelledBookingWireSchema } from '@/lib/wire-schemas';
import type { WireBooking } from '@/lib/wire-schemas';

export interface CancelBookingProps {
  booking: WireBooking;
}

/**
 * The vendor's own way out of a confirmed booking (VEN-659).
 *
 * The customer is refunded in full whatever the timing, and the API refuses a
 * paid-out or past booking, so the control is only offered where it can work:
 * the same `confirmed`, universally-future, not-paid-out test the API applies
 * (`isUniversallyFutureDate`, not the vendor's own day, which for a vendor east
 * of UTC can already be the event's while the API still refuses). The API's
 * refusals stay the authority; this only avoids offering a button that
 * answers 409.
 */
export function CancelBooking({ booking }: CancelBookingProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  if (
    cancelled ||
    booking.status !== 'confirmed' ||
    !isUniversallyFutureDate(booking.eventDate) ||
    booking.payoutReleasedAt
  ) {
    return <></>;
  }

  const refund = formatPrice(vendorCancellationRefundCents(booking.totalAmountCents));
  const reasonId = `cancel-reason-${booking.id}`;
  const consequenceId = `cancel-consequence-${booking.id}`;

  async function cancel(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/vendor/bookings/${booking.id}/cancel`, {
        method: 'PUT',
        body: { reason: reason.trim() },
        schema: cancelledBookingWireSchema,
      });
      setCancelled(true);
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      /* Refreshed whichever way it went, as the customer's cancel is (#405). */
      router.refresh();
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        Cancel booking
      </Button>
    );
  }

  return (
    <div className="flex w-72 max-w-full flex-col gap-2 text-left">
      <Label htmlFor={reasonId}>Reason for the customer</Label>
      <Textarea
        id={reasonId}
        aria-required="true"
        aria-describedby={consequenceId}
        autoFocus
        value={reason}
        maxLength={1_000}
        disabled={busy}
        onChange={(event) => setReason(event.target.value)}
      />
      <p id={consequenceId} className="text-xs text-stone-600">
        The customer is refunded {refund} in full and you are not paid for this booking. This cannot
        be undone.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-error-500">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || reason.trim() === ''}
          onClick={() => void cancel()}
        >
          {busy ? 'Cancelling…' : `Yes, cancel and refund ${refund}`}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Keep the booking
        </Button>
      </div>
    </div>
  );
}
