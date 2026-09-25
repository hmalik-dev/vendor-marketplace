import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account-shell';
import { requireNonAdmin } from '@/lib/current-user';

/**
 * The session gate, above `loading.tsx` rather than only inside the page
 * (VEN-379) — see `bookings/(hub)/layout.tsx` for why a gate under a loading boundary
 * answers HTTP 200 instead of a redirect. The page keeps its own call, which
 * carries a validated `?conversation=`; this one carries the stamped request
 * path, and `signInPathReturningTo` re-validates it either way.
 *
 * An admin has no inbox and no one to write to, so they go to the console
 * (VEN-702); customers and vendors render, the customer beside frame `07`'s
 * sidebar and the vendor with no nav (VEN-745).
 */
export default async function MessagesLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const user = await requireNonAdmin();

  return (
    <AccountShell current={user.role === 'customer' ? 'messages' : null}>{children}</AccountShell>
  );
}
