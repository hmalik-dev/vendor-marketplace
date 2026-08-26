import type { ReactNode } from 'react';
import { requireRole } from '@/lib/current-user';

/** Customers that wander into `/vendor/*` are sent back to their own dashboard. */
export default async function VendorLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('vendor');

  return <>{children}</>;
}
