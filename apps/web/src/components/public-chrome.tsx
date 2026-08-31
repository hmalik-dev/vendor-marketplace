'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * The operations console. One constant, read by both predicates below — see
 * `isAdminRoute` for why they must agree.
 */
const ADMIN_PREFIX = '/admin';

/**
 * Route prefixes that are the application rather than the marketplace's public
 * face. They own the whole viewport: a full-height pane layout and a marketing
 * footer underneath it are incompatible, because the footer's height is what
 * makes the *page* scroll when only the panes are supposed to.
 */
const APP_ROUTE_PREFIXES = [
  ADMIN_PREFIX,
  '/bookings',
  '/customer',
  '/messages',
  '/vendor/',
] as const;

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
 * The console, which is an app route **and** replaces the header rather than
 * only the footer.
 *
 * Both predicates read `ADMIN_PREFIX` so the two answers cannot drift: the
 * console briefly counted `/administrators` as an app route (prefix test) but
 * not as an admin route (segment test), which would have drawn the marketplace
 * header with no footer under it.
 */
export function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

/**
 * Renders its children everywhere except the console.
 *
 * The console draws its own inverted header (frame `13`), and `SiteHeader`
 * lives in the root layout above every route — so this removes it here rather
 * than threading a `showHeader` flag through every layout in between, which is
 * the same argument `PublicChrome` makes for the footer.
 */
export function OutsideAdmin({ children }: { children: ReactNode }): React.ReactNode {
  return isAdminRoute(usePathname()) ? null : children;
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
