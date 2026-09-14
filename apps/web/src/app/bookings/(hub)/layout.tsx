import type { ReactNode } from 'react';
import { requireRole } from '@/lib/current-user';

/**
 * The customer gate, in a layout beside `loading.tsx` rather than only inside
 * the page it wraps (VEN-379).
 *
 * A loading boundary streams: its 200 shell is flushed before the page renders,
 * so the page's own `requireRole` could no longer answer 307. The redirect went
 * out in the stream as a meta refresh instead, and a signed-out visitor — or a
 * brand-new account still owed the Terms interstitial — got HTTP 200 at
 * `/bookings`, holding the gated URL until the client router caught up. A
 * layout renders before the boundary it wraps, so this gate answers with a real
 * redirect. The page keeps its own call; `getCurrentUser` is per-request cached,
 * so the second read costs nothing.
 *
 * **Scoped to the hub, not `bookings/`.** The request pages below have no
 * loading boundary, so their page gates already answer 307 — and a gate above
 * them would throw an unreachable API above `checkout/error.tsx`, trading
 * checkout's own error shell for the bare root one.
 *
 * The destination comes from the request path the middleware stamped, since a
 * layout has no `searchParams` — the hub drops a `?tab=` it does not recognise
 * on arrival, so carrying the raw query is harmless.
 */
export default async function BookingsHubLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('customer');

  return <>{children}</>;
}
