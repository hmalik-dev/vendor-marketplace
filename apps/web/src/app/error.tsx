'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';

/**
 * Catches a throw anywhere below the root layout — which is what makes the
 * recovery possible at all: `reset()` re-renders only the failed segment, so
 * the visitor is not sent back to a cold document.
 *
 * **The shell does not stay up, and that is the change #372 made.** This used
 * to say the header, footer and navigation survive; frame `16` draws neither,
 * and leaving them made the page scroll past its own recovery controls. The
 * screen draws its own 64px header instead and marks itself so one `:has()`
 * rule in `globals.css` takes the site's chrome down — the header and footer
 * are this boundary's *siblings*, above it in the tree, so nothing rendered
 * here could remove them. See `error-screen.tsx`.
 *
 * `digest` is Next's own hash of the error, written to the server log at the
 * moment it was thrown. Showing that rather than an id generated here is what
 * makes the reference on screen worth pasting to support: the two match.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // The digest is on the server log already; this ties the client half of
    // the story to it for anyone reading a browser console or session replay.
    console.error(`Unhandled render error${error.digest ? ` [${error.digest}]` : ''}`, error);
  }, [error]);

  return <ErrorScreen digest={error.digest} reset={reset} />;
}
