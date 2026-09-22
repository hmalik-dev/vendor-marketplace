'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from '@/lib/auth/auth-requests';

/**
 * Asks for a reset code. Every address goes on to the same next screen: the
 * proxy answers alike whether or not an account exists, and this form never
 * says otherwise.
 */
export function ForgotPasswordForm(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setFailure(null);

    const address = email.trim();
    const outcome = await requestPasswordReset(address);
    if (outcome !== 'ok') {
      setBusy(false);
      setFailure(failureCopy(outcome, AUTH_COPY.unreachable));
      return;
    }

    router.push(`/reset-password?email=${encodeURIComponent(address)}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      {failure ? (
        <Banner status="failed" className="mb-4">
          {failure}
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

      <Button type="submit" loading={busy} disabled={email.trim() === ''}>
        {AUTH_COPY.forgotSubmit}
      </Button>

      <p className="mt-5 text-center text-cta text-stone-700">
        <Link href="/sign-in" className="font-semibold text-clay-500 hover:underline">
          {AUTH_COPY.forgotBack}
        </Link>
      </p>
    </form>
  );
}
