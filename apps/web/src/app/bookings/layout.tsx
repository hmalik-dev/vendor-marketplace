import type { ReactNode } from 'react';
import { requireRole } from '@/lib/current-user';

/**
 * The customer gate, above `(hub)/loading.tsx` rather than only inside the page
 * beneath it (VEN-379).
 *
 * A loading boundary streams: its 200 shell is flushed before the page renders,
 * so the page's own `requireRole` could no longer answer 307. The redirect went
 * out in the stream as a meta refresh instead, and a signed-out visitor — or a
 * brand-new account still owed the Terms interstitial — got HTTP 200 at
 * `/bookings`, holding the gated URL until the client router caught up. A
 * layout renders before the boundary it wraps, so this gate answers with a real
 * redirect. The pages keep their own calls; `getCurrentUser` is per-request
 * cached, so the second read costs nothing.
 *
 * The destination comes from the request path the middleware stamped, since a
 * layout has no `searchParams` — the hub drops a `?tab=` it does not recognise
 * on arrival, so carrying the raw query is harmless.
 */
export default async function BookingsLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('customer');

  return <>{children}</>;
}
