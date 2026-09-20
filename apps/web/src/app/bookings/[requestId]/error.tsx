'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';
import { boundaryCaptureContext } from '@/config/error-reporting';

/**
 * A failed read on a booking's page — a screen only a customer who has paid
 * (or a vendor who was paid) reaches.
 *
 * The root boundary tells the reader no payment was taken. Here the boundary
 * cannot tell a failed read from a failed charge, so it asserts neither, the
 * way `confirmed/error.tsx` does one segment down.
 */
export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error(`Unhandled booking error${error.digest ? ` [${error.digest}]` : ''}`, error);
    Sentry.captureException(error, boundaryCaptureContext({ payment: true, digest: error.digest }));
  }, [error]);

  return <ErrorScreen digest={error.digest} reset={reset} payment="unknown" />;
}
