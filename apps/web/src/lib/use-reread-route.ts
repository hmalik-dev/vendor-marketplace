'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Re-reads the current page from the server after a write, in place of
 * `router.refresh()` (VEN-781).
 *
 * A signed-in `router.refresh()` intermittently never commits. Its RSC request
 * answers 200 with the whole body and Next's action queue finishes, but React
 * leaves the transition suspended and the page keeps showing the pre-write
 * state indefinitely: 4–6 of 12 refreshes on a vendor profile, reproduced
 * locally on a production build. A `replace` to the same URL re-renders only
 * the page segment and committed 12 of 12 on the same page, with a fresh server
 * read each time (the pages are dynamic).
 *
 * What it does not re-render: layouts. Use it only where the layouts above the
 * page are gates with no data of their own. The hash is left off on purpose,
 * because a URL that differs only by its hash is a hash-only navigation, and
 * Next never fetches for one.
 */
export function useRereadRoute(): () => void {
  const router = useRouter();

  return useCallback(() => {
    router.replace(`${window.location.pathname}${window.location.search}`, { scroll: false });
  }, [router]);
}
