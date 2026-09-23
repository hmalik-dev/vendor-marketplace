'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import {
  type AuthOutcome,
  resendVerificationCode,
  signInWithEmail,
  verifyEmailCode,
} from '@/lib/auth/auth-requests';

export interface VerifyEmailStepProps {
  email: string;
  password: string;
  /** Where a verified, signed-in person goes next — always through `/after-sign-in`. */
  destination: string;
  /** Ask Neon for a fresh code on arrival (the sign-in route, where none was just sent). */
  sendOnMount?: boolean;
  /** What the caller's own code request answered (sign-up sends before this mounts). */
  sendOutcome?: AuthOutcome;
}

type StepMessage = { status: 'failed' | 'informational'; text: string } | null;

/**
 * A refused code request, said on arrival. Neon's own limiter counts every
 * visitor as the one server calling it, so a send can be refused on a
 * visitor's first try (VEN-620); left silent, the step asks for a code that
 * was never mailed and the next one typed reads as wrong.
 */
function sendFailure(outcome: AuthOutcome): StepMessage {
  return outcome === 'ok'
    ? null
    : { status: 'failed', text: failureCopy(outcome, AUTH_COPY.unreachable) };
}

/**
 * The six-digit code step. Neon signs nobody in on verification, so a good code
 * is followed by a sign-in with the credentials this step was handed; a person
 * is never asked for the password twice.
 */
export function VerifyEmailStep({
  email,
  password,
  destination,
  sendOnMount = false,
  sendOutcome = 'ok',
}: VerifyEmailStepProps): React.ReactElement {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<StepMessage>(() => sendFailure(sendOutcome));
  /* The arrival send's answer is dropped once anything newer has spoken, so a
     slow refusal cannot overwrite a later resend's or code check's message. */
  const arrivalSendLive = useRef(false);

  useEffect(() => {
    if (!sendOnMount) {
      return;
    }

    arrivalSendLive.current = true;
    void resendVerificationCode(email).then((outcome) => {
      if (arrivalSendLive.current && outcome !== 'ok') {
        setMessage(sendFailure(outcome));
      }
    });

    return () => {
      arrivalSendLive.current = false;
    };
  }, [email, sendOnMount]);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    arrivalSendLive.current = false;

    const verified = await verifyEmailCode({ email, otp: code.trim() });
    if (verified !== 'ok') {
      setBusy(false);
      setMessage({
        status: 'failed',
        // `codeInvalid` means this code is dead after too many wrong guesses
        // (Better Auth's own limit, 3 by default) — no wait fixes that, only
        // a fresh code does, so it is worded and handled apart from `failureCopy`.
        text:
          verified === 'codeInvalid'
            ? AUTH_COPY.codeExhausted
            : failureCopy(verified, AUTH_COPY.codeWrong),
      });
      return;
    }

    const signedIn = await signInWithEmail({ email, password });
    if (signedIn !== 'ok') {
      setBusy(false);
      setMessage({ status: 'failed', text: failureCopy(signedIn, AUTH_COPY.unreachable) });
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  async function resend(): Promise<void> {
    arrivalSendLive.current = false;
    const outcome = await resendVerificationCode(email);
    setMessage(
      outcome === 'ok'
        ? { status: 'informational', text: AUTH_COPY.codeResent }
        : sendFailure(outcome),
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
        label={AUTH_COPY.codeLabel}
        helper={AUTH_COPY.codeHelper}
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />

      <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>
        {AUTH_COPY.codeSubmit}
      </Button>
      <Button type="button" variant="ghost" className="mt-2" onClick={() => void resend()}>
        {AUTH_COPY.codeResend}
      </Button>
    </form>
  );
}
