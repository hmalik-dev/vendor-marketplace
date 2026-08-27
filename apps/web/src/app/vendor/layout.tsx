import type { ReactNode } from 'react';
import { VendorNav } from '@/components/vendor-nav';
import { requireRole } from '@/lib/current-user';

/**
 * Every vendor surface sits beside the same navigation rail — 200px from `lg`,
 * widening to the full 240px sidebar at `xl`, per the degradation table in
 * design/design-plan/04-laws.md. Page height is left to each surface: the app shells own
 * their scrolling, and the profile form is allowed to run past one screen.
 */
export default async function VendorLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  await requireRole('vendor');

  return (
    <div className="lg:grid lg:grid-cols-[var(--sidebar-width-sm)_1fr] lg:items-start xl:grid-cols-[var(--sidebar-width)_1fr]">
      <VendorNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
