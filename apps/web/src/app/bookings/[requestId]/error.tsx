'use client';

import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';
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
  const router = useRouter();

  useEffect(() => {
    console.error(`Unhandled booking error${error.digest ? ` [${error.digest}]` : ''}`, error);
    Sentry.captureException(error, boundaryCaptureContext({ payment: true, digest: error.digest }));
  }, [error]);

  // `reset()` alone reuses the server payload that failed; refetch it first.
  const retry = (): void => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return <ErrorScreen digest={error.digest} reset={retry} payment="unknown" />;
}
