'use client';

import {
  adminStepUpResultSchema,
  closeOwnAccountResultSchema,
  type AdminCloseBlocker,
  type UserRole,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ACCOUNT_CLOSED_PATH } from '@/components/account/settings-paths';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth/auth-requests';
import { clearSessionToken } from '@/lib/auth/client';
import { formatEventDate } from '@/lib/booking-entries';
import { reportSwallowedError } from '@/lib/report-error';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';

const CODE_LENGTH = 6;
const CODE_PATTERN = /^\d{6}$/;
const BOOKINGS_PATH = '/bookings';

const NO_CODE_SENT = 'We could not send the code. Try again in a moment.';
const NOT_CLOSED =
  'We could not confirm the closure. Check the address and the code, or reload to see whether it went through.';

/** What stays and what goes, from the privacy policy's "Your rights" and "How long we keep it". */
const KEPT_AND_REMOVED: readonly string[] = [
  'Your account is retired and you are signed out everywhere. Signing in again will not work.',
  'Your name, contact details and photo are removed from your account.',
  'Payment and booking records stay, because the law and the other side of each booking require them.',
  'Your record of accepting our legal documents stays, and is not removable.',
];

const VENDOR_ADDITIONS: readonly string[] = [
  'Your storefront comes off the marketplace immediately and the requests still open against you are declined.',
  'Customers holding upcoming bookings with you are refunded in full, and you are paid nothing for them.',
];

export interface CloseAccountFormProps {
  role: UserRole;
  /** The address on the account, typed back to confirm. */
  email: string;
  /** Upcoming confirmed bookings of the person's own, which refuse the closure (D39). */
  blockers: AdminCloseBlocker[];
}

/**
 * The Close account page's body (VEN-680). Refused while the person holds an
 * upcoming confirmed booking, and says which; otherwise a code is emailed to
 * the address on the account, and the closure runs only with that code and the
 * address typed back. Neutral, not red: it is a decision, not a failure
 * (`40-states.md`). Once closed the browser is signed out and taken to a
 * farewell page.
 */
export function CloseAccountForm({
  role,
  email,
  blockers,
}: CloseAccountFormProps): React.ReactElement {
  const call = useApi();
  const [codeSent, setCodeSent] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (blockers.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* `Banner` wraps its children in a `<p>`, so the list sits beside it, not inside. */}
        <Banner
          status="pending"
          title={`Cancel your upcoming ${blockers.length === 1 ? 'booking' : 'bookings'} first`}
        >
          Closing your account never prices a cancellation for you. Cancel{' '}
          {blockers.length === 1 ? 'this booking' : 'these bookings'} from{' '}
          <Link href={BOOKINGS_PATH} className="font-semibold underline">
            your bookings
          </Link>
          , where the refund is priced the way every cancellation is.
        </Banner>
        <ul className="list-disc pl-5 text-sm text-stone-700">
          {blockers.map((blocker) => (
            <li key={blocker.bookingId}>
              {formatEventDate(blocker.eventDate)} with {blocker.counterpartyName}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  async function sendCode(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    setProblem(null);

    try {
      await call('/users/me/close/challenge', {
        method: 'POST',
        schema: adminStepUpResultSchema,
      });
      setCodeSent(true);
    } catch (error) {
      setProblem(userFacingError(error, NO_CODE_SENT));
    }

    setBusy(false);
  }

  async function close(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    if (typedEmail.trim() === '' || !CODE_PATTERN.test(code)) {
      setProblem(NOT_CLOSED);
      return;
    }

    setBusy(true);
    setProblem(null);

    try {
      await call('/users/me/close', {
        method: 'POST',
        body: { email: typedEmail.trim(), code },
        schema: closeOwnAccountResultSchema,
      });
    } catch (error) {
      setProblem(userFacingError(error, NOT_CLOSED));
      setBusy(false);
      return;
    }

    // Closed: end the browser's session too. A sign-out that cannot reach the provider changes nothing, because the account no longer resolves.
    await signOut().catch((error: unknown) =>
      reportSwallowedError('account closure: signing the browser out failed', error),
    );
    clearSessionToken();
    window.location.assign(ACCOUNT_CLOSED_PATH);
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      {problem ? (
        <Banner status="failed" role="alert">
          {problem}
        </Banner>
      ) : null}

      <ul className="list-disc pl-5 text-sm text-stone-700">
        {[...KEPT_AND_REMOVED, ...(role === 'vendor' ? VENDOR_ADDITIONS : [])].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {codeSent ? (
        <form onSubmit={close} noValidate className="flex flex-col">
          <Banner status="informational" role="status" className="mb-4">
            We emailed a {CODE_LENGTH}-digit code to {email}.
          </Banner>
          <AuthField
            label="Type your email address to confirm"
            type="email"
            name="confirm-email"
            autoComplete="off"
            required
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
          />
          <AuthField
            label="Code from the email"
            inputMode="numeric"
            name="code"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
          <Button
            type="submit"
            loading={busy}
            disabled={typedEmail === '' || code.length < CODE_LENGTH}
          >
            Close my account
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={busy}
            onClick={sendCode}
          >
            Send a new code
          </Button>
        </form>
      ) : (
        <Button type="button" loading={busy} onClick={sendCode}>
          Email me a code
        </Button>
      )}
    </div>
  );
}
