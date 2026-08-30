'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/errors/error-screen';
import './globals.css';

/**
 * The last boundary: a throw in the root layout itself, where `error.tsx`
 * cannot help because the layout that would have wrapped it is the thing that
 * failed. It replaces the whole document, so it supplies its own `html` and
 * `body` — and its own stylesheet import, since the layout that normally loads
 * `globals.css` never ran.
 *
 * The fonts are the layout's too, so this renders in the fallback stack rather
 * than Instrument Serif. That is the correct trade: the alternative is Next's
 * stock black-on-white page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error(`Root layout error${error.digest ? ` [${error.digest}]` : ''}`, error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-stone-50">
        <ErrorScreen digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}
