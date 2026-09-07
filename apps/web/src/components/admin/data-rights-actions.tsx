'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import {
  wireAdminCloseAccountResultSchema,
  wireAdminUserExportSchema,
  type WireAdminCloseBlocker,
} from '@/lib/wire-schemas';

export interface DataRightsActionsProps {
  userId: string;
  name: string;
  /** `null` while the account is live; a date once it has been closed. */
  closedAt: Date | null;
  /** The upcoming confirmed bookings that would refuse a closure (D39). */
  closeBlockers: readonly WireAdminCloseBlocker[];
}

/**
 * The two things the privacy policy promises, as controls (#438).
 *
 * The refusal is **stated before it is attempted**. `POST /admin/users/:id/close`
 * answers 409 while an upcoming confirmed booking stands, and an operator on a
 * support call needs to know that before they click and read an error — so the
 * button is disabled and the bookings are named, and the API's refusal is the
 * guarantee rather than the explanation.
 */
export function DataRightsActions({
  userId,
  name,
  closedAt,
  closeBlockers,
}: DataRightsActionsProps): React.ReactElement {
  const call = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportRecord(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const archive = await call(`/admin/users/${userId}/export`, {
        method: 'POST',
        schema: wireAdminUserExportSchema,
      });

      /*
       * Handed to the operator as a file rather than rendered on the page.
       *
       * What they have to do with it is send it to the person who asked, and a
       * screen of JSON is not something anybody can forward. The object URL is
       * revoked immediately after the click: it holds the whole archive in
       * memory, and this is the one payload on the console that should not
       * outlive the download by a single navigation.
       */
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = href;
      link.download = `orla-data-export-${userId}.json`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      setBusy(false);
    }
  }

  async function close(): Promise<void> {
    await call(`/admin/users/${userId}/close`, {
      method: 'POST',
      schema: wireAdminCloseAccountResultSchema,
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void exportRecord()}
        >
          {busy ? 'Working…' : 'Export their record'}
        </Button>

        {closedAt ? (
          <span className="text-meta text-stone-600">
            Closed {closedAt.toISOString().slice(0, 10)}
          </span>
        ) : closeBlockers.length > 0 ? (
          <Button type="button" variant="secondary" size="sm" disabled>
            Close account
          </Button>
        ) : (
          <ConfirmAction
            trigger={
              <Button type="button" variant="destructive" size="sm">
                Close account
              </Button>
            }
            title={`Close ${name}'s account?`}
            destructive
            description={
              <>
                This retires the account and takes any storefront off the marketplace immediately,
                and declines every request still open against it. It refunds nothing and prices
                nothing.
                <br />
                <br />
                Their bookings, messages, reviews and legal acceptances are kept — the privacy
                policy says so, and this page keeps showing them.
              </>
            }
            confirmLabel="Close account"
            onConfirm={close}
          />
        )}
      </div>

      {closeBlockers.length > 0 && !closedAt ? (
        <p className="text-sm text-stone-700">
          This account cannot be closed while it holds{' '}
          {closeBlockers.length === 1
            ? 'an upcoming confirmed booking'
            : 'upcoming confirmed bookings'}
          . They have to be cancelled from the booking screens first, where the refund is priced:{' '}
          {closeBlockers
            .map((booking) => `${booking.eventDate} with ${booking.counterpartyName}`)
            .join(', ')}
          .
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
