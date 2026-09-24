import type { ReactNode } from 'react';
import { gateBookingRequest } from '@/lib/booking-route';

/**
 * The request detail's customer gate and its 404, above `loading.tsx` (VEN-715).
 *
 * A loading boundary streams, so a `notFound()` or `requireRole` in the page
 * would answer 200 with a soft 404 or a meta refresh. This layout renders before
 * the boundary, so a signed-out visitor gets a 307 and a missing or not-yours
 * request a real 404. A route group, not `[requestId]/layout.tsx`: the gate must
 * sit **inside** `[requestId]/error.tsx` (an unreachable API keeps the booking
 * error screen) and must not run for `checkout`, whose 404 wears its own shell.
 */
export default async function BookingDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ requestId: string }>;
}): Promise<React.ReactElement> {
  await gateBookingRequest({ params });

  return <>{children}</>;
}
