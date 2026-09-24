import type { ReactNode } from 'react';
import { gateVendorSlug } from '@/lib/vendor-route';

/**
 * The profile's 404 and its 308 for a renamed slug, above `loading.tsx`
 * (VEN-715). See `gateVendorSlug`.
 *
 * A route group, not `[slug]/layout.tsx`: the gate reads the API, and a layout
 * above `[slug]/error.tsx` would answer an unreachable one with the bare root
 * error screen instead of this route's own.
 */
export default async function VendorProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  await gateVendorSlug((await params).slug);

  return <>{children}</>;
}
