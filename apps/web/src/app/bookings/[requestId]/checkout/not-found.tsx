import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { NotFoundScreen } from '@/components/errors/not-found-screen';

export const metadata: Metadata = { title: pageTitle('Page not found') };

/**
 * Frame `15` for a stale checkout link — a well-formed uuid for a request that
 * does not exist, which `page.tsx` answers with `notFound()`.
 *
 * It exists because the marketplace header is suppressed on this URL
 * (`public-chrome.tsx`), so without a boundary inside this segment's layout the
 * 404 rendered with no header at all: no wordmark, no navigation, on bare
 * ground. `not-found-screen.tsx` states the contract this restores.
 */
export default function CheckoutNotFound(): React.ReactElement {
  return <NotFoundScreen />;
}
