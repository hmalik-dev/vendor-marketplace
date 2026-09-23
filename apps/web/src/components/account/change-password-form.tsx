'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { changePassword } from '@/lib/auth/auth-requests';

type Message = { status: 'failed' | 'informational'; text: string };

/** Sign-up's rule, so a new password is held to what the first one was. */
const MIN_LENGTH = 10;

/** The copy for a change the form refuses on its own, or `null` when it may be sent. */
function refusal(current: string, next: string, confirm: string): string | null {
  if (next.length < MIN_LENGTH) {
    return AUTH_COPY.changeTooShort;
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
 * and keeps this one, so success is a banner here rather than a trip through
 * sign-in; `router.refresh()` re-renders the page on the fresh session.
 */
export function ChangePasswordForm(): React.ReactElement {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    const refused = refusal(current, next, confirm);
    if (refused !== null) {
      setMessage({ status: 'failed', text: refused });
      return;
    }

    setBusy(true);
    setMessage(null);
    const outcome = await changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);

    if (outcome === 'ok') {
      setCurrent('');
      setNext('');
      setConfirm('');
      setMessage({ status: 'informational', text: AUTH_COPY.changeDone });
      router.refresh();
      return;
    }

    setMessage({ status: 'failed', text: failureCopy(outcome, AUTH_COPY.changeWrongCurrent) });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-sm flex-col">
      {message ? (
        <Banner
          status={message.status}
          role={message.status === 'failed' ? 'alert' : 'status'}
          className="mb-4"
        >
          {message.text}
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
