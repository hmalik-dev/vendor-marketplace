'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** `/admin` and everything under it. `/administrators` would not be. */
export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * Renders its children everywhere except the operations console.
 *
 * The console draws its own inverted header (frame `13`), and `SiteHeader`
 * lives in the root layout above every route — so this removes it here rather
 * than threading a `showHeader` flag through every layout in between, which is
 * the same argument `PublicChrome` makes for the footer.
 */
export function OutsideAdmin({ children }: { children: ReactNode }): React.ReactNode {
  return isAdminRoute(usePathname()) ? null : children;
}
