'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';
import { boundaryCaptureContext } from '@/config/error-reporting';

/**
 * A throw on the page a customer lands on straight after paying.
 *
 * The root boundary tells the reader no payment was taken. Here the card has
 * usually just cleared and the read that failed is the one that reconciles it
 * with Stripe, so that sentence would be false; this segment's boundary says
 * only what is known — the payment is being confirmed, and where to look.
 */
export default function ConfirmedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    Sentry.captureException(error, boundaryCaptureContext({ payment: true, digest: error.digest }));
  }, [error]);

  return <ErrorScreen digest={error.digest} reset={reset} payment="unknown" />;
}
