import type { ReactNode } from 'react';
import { requireRole } from '@/lib/current-user';

/** Vendors that wander into `/customer/*` are sent back to their own dashboard. */
export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('customer');

  return <>{children}</>;
}
