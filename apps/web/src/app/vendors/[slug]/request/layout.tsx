import type { ReactNode } from 'react';
import { requireRole } from '@/lib/current-user';
import { gateVendorSlug } from '@/lib/vendor-route';

/**
 * The request form's 404, its 308 for a renamed slug (keeping the customer's
 * choices, VEN-648) and its customer gate, above `loading.tsx` (VEN-715).
 *
 * The gate is the one the API applies, `requireRole('customer')`, so an admin
 * or a vendor is sent to their own dashboard rather than shown a form they
 * cannot submit (#401). The sign-in round trip returns to the stamped request
 * path, query included.
 */
export default async function BookingRequestLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  await gateVendorSlug((await params).slug);
  await requireRole('customer');

  return <>{children}</>;
}
