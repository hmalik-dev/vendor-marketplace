'use client';

import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import { scrubAnalyticsEvent } from './analytics-scrub';
import { isAdminRoute } from './public-chrome';

/**
 * Vercel Web Analytics, minus the operator console.
 *
 * A client component only to read the pathname. `isAdminRoute` rather than
 * `OutsideAdmin`, because the latter also hides checkout, whose page views are
 * wanted. `beforeSend` is a function, so it cannot be passed from the server
 * layout; `scrubAnalyticsEvent` strips ids and query strings from what is sent.
 */
export function WebAnalytics(): React.ReactNode {
  return isAdminRoute(usePathname()) ? null : <Analytics beforeSend={scrubAnalyticsEvent} />;
}
