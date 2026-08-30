'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { wireBookingSchema } from '@/lib/wire-schemas';
import type { WireBooking } from '@/lib/wire-schemas';

export interface CompleteBookingProps {
  booking: WireBooking;
  /** Today as `YYYY-MM-DD`, resolved on the server so the two agree. */
  today: string;
}

/**
 * The vendor's "this happened" control.
 *
 * It moves no money — the charge was a destination charge, so the payout share
 * reached the vendor's account when it settled. What completing does is close
 * the booking and invite the customer's review, which is why it cannot be
 * pressed before the event: a review for an event nobody has been to is worth
 * less than no review.
 *
 * The date guard is here as well as in the API on purpose. The API's is the one
 * that matters, and this one is why the vendor is not offered a button that
 * only ever answers 409.
 */
export function CompleteBooking({ booking, today }: CompleteBookingProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (booking.status === 'completed') {
    return <StatusPill tone="completed">Complete</StatusPill>;
  }

  if (booking.status === 'cancelled') {
    return <StatusPill tone="failed">Cancelled</StatusPill>;
  }

  /*
   * String comparison on two calendar dates, which is what they are. Reading
   * either through a `Date` would put a timezone into a comparison that has
   * none of its own.
   */
  if (booking.eventDate > today) {
    return <></>;
  }

  async function complete(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/vendor/bookings/${booking.id}/complete`, {
        method: 'PUT',
        schema: wireBookingSchema.omit({ eventType: true, venue: true }),
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
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void complete()}>
        {busy ? 'Marking…' : 'Mark complete'}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-error-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
