'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Route prefixes that are the application rather than the marketplace's public
 * face. They own the whole viewport: a full-height pane layout and a marketing
 * footer underneath it are incompatible, because the footer's height is what
 * makes the *page* scroll when only the panes are supposed to.
 */
const APP_ROUTE_PREFIXES = ['/bookings', '/customer', '/vendor/'] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
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
