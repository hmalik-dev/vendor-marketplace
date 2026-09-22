'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { requestPasswordReset, resetPasswordWithCode } from '@/lib/auth/auth-requests';

export interface ResetPasswordFormProps {
  /** From the request screen; editable, so a person already holding a code can arrive without it. */
  initialEmail: string;
}

type Message = { status: 'failed' | 'informational'; text: string };

/**
 * The emailed code and the new password. Neon signs nobody in on a reset, so
 * success ends at the sign-in screen. A refusal is one fixed sentence covering a
 * wrong, used or expired code.
 */
export function ResetPasswordForm({ initialEmail }: ResetPasswordFormProps): React.ReactElement {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<Message | null>(
    initialEmail ? { status: 'informational', text: AUTH_COPY.resetCodeSent } : null,
  );

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);

    const outcome = await resetPasswordWithCode({
      email: email.trim(),
      otp: code.trim(),
      password,
    });
    setBusy(false);

    if (outcome === 'ok') {
      setDone(true);
      return;
    }

    setMessage({
      status: 'failed',
      text: failureCopy(outcome, AUTH_COPY.resetFailed),
    });
  }

  async function resend(): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    const outcome = await requestPasswordReset(email.trim());
    setBusy(false);

    if (outcome === 'ok') {
      setMessage({ status: 'informational', text: AUTH_COPY.resetCodeSent });
      return;
    }

    setMessage({
      status: 'failed',
      text: failureCopy(outcome, AUTH_COPY.unreachable),
    });
  }

  if (done) {
    return (
      <div className="flex flex-col">
        <Banner status="settled" className="mb-4">
          {AUTH_COPY.resetDone}
        </Banner>
        <Link
          href="/sign-in"
          className="text-center text-cta font-semibold text-clay-500 hover:underline"
        >
          {AUTH_COPY.signInSubmit}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      {message ? (
        <Banner status={message.status} className="mb-4">
          {message.text}
        </Banner>
      ) : null}

      <AuthField
        label={AUTH_COPY.emailLabel}
        type="email"
        placeholder="you@example.com"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AuthField
        label={AUTH_COPY.codeLabel}
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <AuthField
        label={AUTH_COPY.resetPasswordLabel}
        helper={AUTH_COPY.passwordHelper}
        type="password"
        placeholder="••••••••••"
        name="password"
        autoComplete="new-password"
        minLength={10}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Button
        type="submit"
        loading={busy}
        disabled={email.trim() === '' || code.trim().length !== 6 || password.length < 10}
      >
        {AUTH_COPY.resetSubmit}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="mt-2"
        disabled={busy || email.trim() === ''}
        onClick={() => void resend()}
      >
        {AUTH_COPY.codeResend}
      </Button>

      <p className="mt-5 text-center text-cta text-stone-700">
        <Link href="/sign-in" className="font-semibold text-clay-500 hover:underline">
          {AUTH_COPY.forgotBack}
        </Link>
      </p>
    </form>
  );
}
