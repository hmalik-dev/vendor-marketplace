import type { ReactNode } from 'react';
import { gateConfirmedBooking } from '@/lib/booking-route';

/**
 * Frame `06`'s gate, above `loading.tsx` (VEN-715): the customer session, a 404
 * for a missing request and the redirect back to checkout for an unpaid one.
 *
 * A route group so it sits inside `confirmed/error.tsx`, whose copy is the only
 * one that does not claim no payment was taken.
 */
export default async function ConfirmedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ requestId: string }>;
}): Promise<React.ReactElement> {
  await gateConfirmedBooking({ params });

  return <>{children}</>;
}
