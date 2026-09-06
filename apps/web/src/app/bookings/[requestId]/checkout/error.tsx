'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';

/**
 * A throw on the screen that takes the money, inside this segment's own shell.
 *
 * The root `error.tsx` says its job is that "the shell — header, footer,
 * navigation — stays up and the visitor keeps a route out". On this URL the
 * marketplace header is suppressed (`public-chrome.tsx`), so that sentence is
 * only true here: rendered inside `layout.tsx`, the failure keeps the wordmark
 * bar the route promises rather than falling to bare ground.
 *
 * `digest` is Next's own hash of the error, written to the server log at the
 * moment it was thrown. Showing that rather than an id generated here is what
 * makes the reference on screen worth pasting to support: the two match.
 */
export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error(`Unhandled checkout error${error.digest ? ` [${error.digest}]` : ''}`, error);
  }, [error]);

  return <ErrorScreen digest={error.digest} reset={reset} />;
}
