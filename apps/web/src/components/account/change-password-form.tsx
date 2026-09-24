'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import type { UserRole } from '@vendor-marketplace/shared';
import { ACCOUNT_PASSWORD_PATH } from '@/components/account/settings-paths';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { changePassword } from '@/lib/auth/auth-requests';
import { signInPathReturningTo } from '@/lib/return-path';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';

/** Sign-up's rule, so a new password is held to what the first one was. */
const MIN_LENGTH = 10;
/** Better Auth's own ceiling, refused here so it never reads as a wrong current password. */
const MAX_LENGTH = 128;

/** The copy for a change the form refuses on its own, or `null` when it may be sent. */
function refusal(current: string, next: string, confirm: string): string | null {
  if (next.length < MIN_LENGTH) {
    return AUTH_COPY.changeTooShort;
  }

  if (next.length > MAX_LENGTH) {
    return AUTH_COPY.changeTooLong;
  }

  if (next !== confirm) {
    return AUTH_COPY.changeMismatch;
  }

  return next === current ? AUTH_COPY.changeSameAsCurrent : null;
}

/**
 * The account settings page's password section (VEN-677): the current
 * password, a new one and its confirmation, in frame `12`'s field and button
 * vocabulary as `/reset-password` uses it. The proxy ends every other session
 * and keeps this one, so success is a trip to the role's home rather than
 * through sign-in. No `router.refresh()` beside the push: the two race, and the
 * destination is fetched with the fresh session cookie anyway.
 */
export function ChangePasswordForm({ role }: { role: UserRole }): React.ReactElement {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    const refused = refusal(current, next, confirm);
    if (refused !== null) {
      setMessage(refused);
      return;
    }

    setBusy(true);
    setMessage(null);
    const outcome = await changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);

    if (outcome === 'ok') {
      router.push(DASHBOARD_PATH_BY_ROLE[role]);
      return;
    }

    if (outcome === 'signedOut') {
      router.push(signInPathReturningTo(ACCOUNT_PASSWORD_PATH));
      return;
    }

    setMessage(failureCopy(outcome, AUTH_COPY.changeWrongCurrent));
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-sm flex-col">
      {message ? (
        <Banner status="failed" role="alert" className="mb-4">
          {message}
        </Banner>
      ) : null}

      <AuthField
        label={AUTH_COPY.currentPasswordLabel}
        type="password"
        name="current-password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <AuthField
        label={AUTH_COPY.resetPasswordLabel}
        helper={AUTH_COPY.passwordHelper}
        type="password"
        name="new-password"
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        required
        value={next}
        onChange={(event) => setNext(event.target.value)}
      />
      <AuthField
        label={AUTH_COPY.confirmPasswordLabel}
        type="password"
        name="confirm-password"
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        required
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />

      <Button type="submit" loading={busy} disabled={current === '' || next === ''}>
        {AUTH_COPY.changeSubmit}
      </Button>
    </form>
  );
}
