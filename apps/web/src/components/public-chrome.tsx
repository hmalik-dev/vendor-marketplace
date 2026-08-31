'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Route prefixes that are the application rather than the marketplace's public
 * face. They own the whole viewport: a full-height pane layout and a marketing
 * footer underneath it are incompatible, because the footer's height is what
 * makes the *page* scroll when only the panes are supposed to.
 */
const APP_ROUTE_PREFIXES = ['/admin', '/bookings', '/customer', '/messages', '/vendor/'] as const;

/**
 * The one application screen that does not live under an application prefix.
 *
 * `/vendors/<slug>` is the public directory; `/vendor/<...>` is the vendor's own
 * workspace. They are one letter apart, and a prefix test cannot separate the
 * profile from the request screen beneath it — `'/vendors/x/request'` does not
 * start with `'/vendor/'`, because index 7 is `s` rather than `/`, so the
 * request screen fell through to the public branch and drew the marketing
 * footer under itself (#192). Frame `04` ends at the rail's "Continue to
 * review".
 *
 * Positional rather than a substring test: exactly one segment for the slug,
 * then `request`, and nothing after it. `/vendors/x/requests` and
 * `/vendors/x/request/extra` are not this screen.
 */
const VENDOR_REQUEST_ROUTE = /^\/vendors\/[^/]+\/request$/;

export function isAppRoute(pathname: string): boolean {
  return (
    VENDOR_REQUEST_ROUTE.test(pathname) ||
    APP_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
    )
  );
}

/**
 * Renders its children only on the public surfaces.
 *
 * A client component purely to read the pathname — the root layout is a server
 * component and cannot, and moving the footer into each public page would put
 * the same three lines in a dozen files and lose one of them.
 */
export function PublicChrome({ children }: { children: ReactNode }): React.ReactNode {
  return isAppRoute(usePathname()) ? null : children;
}
