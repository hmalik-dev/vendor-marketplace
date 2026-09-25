'use client';

import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
      router.refresh();
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
      setConfirming(false);
    } finally {
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
