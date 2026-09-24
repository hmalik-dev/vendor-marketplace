import type { ReactNode } from 'react';
import { gateCheckout } from '@/lib/booking-route';

/**
 * Frame `05`'s gate, above `loading.tsx` (VEN-715): the customer session, the
 * redirect for an already-paid request and the 404 for one that does not exist.
 *
 * A route group under `checkout/layout.tsx` so a 404 thrown here is caught by
 * `checkout/not-found.tsx` and wears the checkout shell, and an unreachable API
 * lands in `checkout/error.tsx` rather than the bare root boundary.
 */
export default async function CheckoutGateLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ requestId: string }>;
}): Promise<React.ReactElement> {
  await gateCheckout({ params });

  return <>{children}</>;
}
