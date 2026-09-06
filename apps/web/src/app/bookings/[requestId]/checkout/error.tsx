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

  /*
   * `chrome={false}`: this segment's `layout.tsx` already draws frame `05`'s
   * wordmark bar, and it is a layout precisely so that this boundary inherits
   * it. `ErrorScreen`'s own 64px header would stack a second one — 128px where
   * the frame draws 64 — and its `min-h-screen` under that bar is one bar's
   * worth of scroll on the screen `14-checkout.md` says must not compete with
   * finishing. `Contact support` moves into the column instead of vanishing.
   */
  return <ErrorScreen digest={error.digest} reset={reset} chrome={false} />;
}
