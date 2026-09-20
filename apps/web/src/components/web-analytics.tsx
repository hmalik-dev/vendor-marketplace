'use client';

import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import { isAdminRoute } from './public-chrome';

/**
 * Vercel Web Analytics, minus the operator console.
 *
 * A client component only to read the pathname. `isAdminRoute` rather than
 * `OutsideAdmin`, because the latter also hides checkout, whose page views are
 * wanted. Path and query scrubbing (`beforeSend`) is VEN-497.
 */
export function WebAnalytics(): React.ReactNode {
  return isAdminRoute(usePathname()) ? null : <Analytics />;
}
