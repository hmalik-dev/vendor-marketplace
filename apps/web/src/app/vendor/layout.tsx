import type { ReactNode } from 'react';
import { VendorNav } from '@/components/vendor-nav';
import { requireRole } from '@/lib/current-user';

/**
 * Every vendor surface sits beside the same navigation rail — 200px from `lg`,
 * widening to the full 240px sidebar at `xl`, per the degradation table in
 * design/design-plan/04-laws.md. Page height is left to each surface: the app
 * shells own their scrolling.
 */
export default async function VendorLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('vendor');

  return (
    // A flex row rather than a grid, so a surface that supplies its own rail —
    // the storefront editor does — can drop `VendorNav` and have the content
    // take the full width instead of leaving an empty column.
    <div className="lg:flex lg:items-start">
      <VendorNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
