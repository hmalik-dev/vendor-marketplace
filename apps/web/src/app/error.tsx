'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';

/**
 * Catches a throw anywhere below the root layout, so the shell — header,
 * footer, navigation — stays up and the visitor keeps a route out.
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
