'use client';

import { BRAND_NAME, toDateString } from '@vendor-marketplace/shared';
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
  /**
   * Upcoming confirmed bookings held **as the vendor**, which the closure
   * cancels and refunds in full. The operator is told before they confirm.
   */
  bookingsRefundedOnClose: number;
  /** `true` where this record is the signed-in operator's own account. */
  isSelf: boolean;
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
  bookingsRefundedOnClose,
  isSelf,
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
       * revoked as soon as the download has taken it: it holds the whole
       * archive in memory, and this is the one payload on the console that
       * should not outlive the download by a navigation.
       *
       * **A task later, not the next statement.** Revoking synchronously after
       * `click()` is what Chrome tolerates and Firefox has historically
       * cancelled the download over — the fetch of a `blob:` URL is started by
       * the click but not finished by it. One macrotask is the smallest delay
       * that is after the download begins and before anything a person could
       * do next.
       */
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = href;
      link.download = `${BRAND_NAME.toLowerCase()}-data-export-${userId}.json`;
      /*
       * Attached before the click and removed after it. A programmatic click
       * on a **detached** anchor downloads in Chrome and has historically done
       * nothing in Firefox — and nothing is what it would look like here: the
       * request succeeded, `busy` clears, no error renders, and no file
       * arrives for the person who asked for it.
       */
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    } finally {
      setBusy(false);
    }
  }

  async function close(): Promise<void> {
    const result = await call(`/admin/users/${userId}/close`, {
      method: 'POST',
      schema: wireAdminCloseAccountResultSchema,
    });

    /*
     * #400's signal, on this route too. A closure whose refunds did not all
     * issue leaves money at Stripe, a customer untold and a date still held —
     * and the account is closed either way, so a silent refresh would show an
     * operator a success that is only partly one.
     */
    const stranded = result.refundsFailed + result.bookingsLeftForReview;

    setError(
      stranded > 0
        ? `The account is closed, but ${stranded} ${
            stranded === 1 ? 'booking is' : 'bookings are'
          } still confirmed and unrefunded. That needs a person: the money is still at Stripe and the customer has not been told.`
        : null,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        The refusal, drawn **above** the control it refuses (Pattern B, #454).

        #438 built the prevention and this changes only where it is drawn and
        what colour it is, which is not cosmetic: the explanation sat *below*
        the button, so an operator read a disabled control first and the reason
        second, and a disabled button with no visible cause is indistinguishable
        from a broken one. Gold because `40-states.md` reserves it for waiting on
        someone — this account is waiting on a booking, and nothing has failed.

        **D39's 409 is shown before the press, never as an error after it.** The
        API's refusal is the guarantee; this is the explanation.
      */}
      {!closedAt && (isSelf || closeBlockers.length > 0) ? (
        <div className="rounded-lg border border-gold-200 bg-gold-50 px-3.5 py-3 text-sm leading-prose text-stone-900">
          {isSelf ? (
            <>
              <strong className="font-semibold">Can&apos;t close: this is your own account.</strong>{' '}
              Every action on this console is recorded against the operator who took it, and an
              audit trail its own actor can end is not one.
            </>
          ) : (
            <>
              <strong className="font-semibold">
                Can&apos;t close: {closeBlockers.length} confirmed{' '}
                {closeBlockers.length === 1 ? 'booking' : 'bookings'} on{' '}
                {closeBlockers.map((booking) => booking.eventDate).join(', ')}.
              </strong>{' '}
              Cancel or complete {closeBlockers.length === 1 ? 'it' : 'them'} first, from the
              booking screens, where the refund is priced.
              <ul className="mt-1.5 flex flex-col gap-0.5 text-stone-700">
                {closeBlockers.map((booking) => (
                  <li key={booking.bookingId}>
                    {booking.eventDate} with {booking.counterpartyName}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

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
          <span className="text-meta text-stone-600">Closed {toDateString(closedAt)}</span>
        ) : isSelf || closeBlockers.length > 0 ? (
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
                and declines every request still open against it.{' '}
                {bookingsRefundedOnClose > 0
                  ? `It also cancels the ${bookingsRefundedOnClose} upcoming confirmed ${
                      bookingsRefundedOnClose === 1 ? 'booking' : 'bookings'
                    } their customers hold with them and refunds ${
                      bookingsRefundedOnClose === 1 ? 'it' : 'them'
                    } in full, paying this vendor nothing. Any refund Stripe refuses is reported back here rather than retried.`
                  : 'It refunds nothing and prices nothing.'}
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

      {error ? (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
