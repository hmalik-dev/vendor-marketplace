'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Renders its children only on one pathname — a Server Component's way to
 * scope a piece of shared chrome to a single page, since it cannot read the
 * pathname itself. The children stay server-rendered.
 */
export function OnPath({ path, children }: { path: string; children: ReactNode }): ReactNode {
  return usePathname() === path ? children : null;
}
