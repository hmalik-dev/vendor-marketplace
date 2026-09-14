import type { ReactNode } from 'react';
import { requireCurrentUser } from '@/lib/current-user';

/**
 * The session gate, above `loading.tsx` rather than only inside the page
 * (VEN-379) — see `bookings/(hub)/layout.tsx` for why a gate under a loading boundary
 * answers HTTP 200 instead of a redirect. The page keeps its own call, which
 * carries a validated `?conversation=`; this one carries the stamped request
 * path, and `signInPathReturningTo` re-validates it either way.
 */
export default async function MessagesLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireCurrentUser();

  return <>{children}</>;
}
