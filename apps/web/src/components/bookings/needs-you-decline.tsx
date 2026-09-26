'use client';

import { useRereadRoute } from '@/lib/use-reread-route';
import { useState } from 'react';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import { useApi } from '@/lib/use-api';
import { wireBookingRequestSchema } from '@/lib/wire-schemas';

const TEXT_ACTION =
  'px-1 py-1.75 text-sm font-semibold text-stone-700 hover:underline disabled:opacity-60';

/**
 * `Decline` beside a quote in the `Needs you` panel (VEN-746).
 *
 * A decline cannot be undone by the customer, and it sits beside `Review
 * quote`, so the first press only asks: `Confirm decline` sends it, `Keep`
 * puts the button back. The call is the one the request detail page makes
 * (`quote-review.tsx`), with the same failure copy.
 */
export function NeedsYouDecline({ requestId }: { requestId: string }): React.ReactElement {
  const call = useApi();
  const rereadRoute = useRereadRoute();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decline(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/booking-requests/${requestId}/decline`, {
        schema: wireBookingRequestSchema,
        method: 'POST',
      });
      // Still busy until the refresh removes the panel: a second press would
      // decline a request that is already declined, and show its 403.
      rereadRoute();
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
      setConfirming(false);
      setBusy(false);
    }
  }

  return (
    <>
      {confirming ? (
        <>
          <button type="button" className={TEXT_ACTION} disabled={busy} onClick={decline}>
            Confirm decline
          </button>
          <button
            type="button"
            className={TEXT_ACTION}
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Keep
          </button>
        </>
      ) : (
        <button type="button" className={TEXT_ACTION} onClick={() => setConfirming(true)}>
          Decline
        </button>
      )}
      {error ? (
        <p role="alert" className="basis-full text-xs text-error-500">
          {error}
        </p>
      ) : null}
    </>
  );
}
