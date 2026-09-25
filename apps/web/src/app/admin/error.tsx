'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';
import { boundaryCaptureContext } from '@/config/error-reporting';

/**
 * A throw on a console screen, inside the console's own shell.
 *
 * Without this a failed admin read fell to the root `error.tsx`, whose screen
 * takes the site chrome down and offers the marketplace as the way out — an
 * admin mid-moderation lost the rail and the header they were working in.
 * Rendered inside `layout.tsx`, the failure keeps them, and `reset()`
 * re-renders only the failed screen.
 *
 * `chrome={false}` for the reason checkout's boundary gives: the layout already
 * draws the header, and a second 64px bar under it is the scroll that screen
 * was rebuilt to remove.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error(`Unhandled admin error${error.digest ? ` [${error.digest}]` : ''}`, error);
    Sentry.captureException(
      error,
      boundaryCaptureContext({ payment: false, digest: error.digest }),
    );
  }, [error]);

  return <ErrorScreen digest={error.digest} reset={reset} chrome={false} />;
}
