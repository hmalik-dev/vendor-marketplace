'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { VerifyEmailStep } from '@/components/auth/verify-email-step';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { signInWithEmail } from '@/lib/auth/auth-requests';

export interface SignInFormProps {
  /** `/after-sign-in`, carrying the visitor's validated `returnTo` when there is one. */
  destination: string;
}

/**
 * Email and password against the Neon Auth proxy. A refusal is one fixed
 * sentence — never the upstream message, which would tell a stranger whether an
 * address has an account. An unverified address is routed to the code step
 * instead, where a fresh code is requested on arrival.
 */
export function SignInForm({ destination }: SignInFormProps): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setFailure(null);

    const outcome = await signInWithEmail({ email: email.trim(), password });

    if (outcome === 'ok') {
      router.replace(destination);
      router.refresh();
      return;
    }

    setBusy(false);

    if (outcome === 'unverified') {
      setVerifying(true);
      return;
    }

    // A throttled sign-in names the way in that is never throttled: the reset.
    setFailure(
      outcome === 'throttled'
        ? AUTH_COPY.signInThrottled
        : failureCopy(outcome, AUTH_COPY.signInFailed),
    );
  }

  // Neither a network failure nor a throttle says anything about what the reader typed.
  const credentialsRefused =
    failure !== null && failure !== AUTH_COPY.unreachable && failure !== AUTH_COPY.signInThrottled;

  if (verifying) {
    return (
      <VerifyEmailStep
        email={email.trim()}
        password={password}
        destination={destination}
        sendOnMount
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      {failure ? (
        <Banner status="failed" role="alert" className="mb-4">
          {failure}
        </Banner>
      ) : null}

      <AuthField
        label={AUTH_COPY.emailLabel}
        type="email"
        placeholder="you@example.com"
        name="email"
        autoComplete="email"
        aria-invalid={credentialsRefused ? true : undefined}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AuthField
        label={AUTH_COPY.passwordLabel}
        type="password"
        placeholder="••••••••••"
        name="password"
        autoComplete="current-password"
        aria-invalid={credentialsRefused ? true : undefined}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Link
        href="/forgot-password"
        className="-mt-2 mb-2 inline-flex min-h-11 items-center self-end text-cta font-semibold text-clay-500 hover:underline"
      >
        {AUTH_COPY.forgotLink}
      </Link>

      <Button
        type="submit"
        className="py-3.25"
        loading={busy}
        disabled={email.trim() === '' || password === ''}
      >
        {AUTH_COPY.signInSubmit}
      </Button>

      <p className="mt-5 text-center text-action text-stone-700">
        {AUTH_COPY.signInAlt}{' '}
        <Link href="/sign-up" className="font-semibold text-clay-500 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
