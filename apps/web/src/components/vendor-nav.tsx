'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Images, LayoutDashboard, Package, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VendorNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Ordered the way a vendor sets a business up: describe it, price it, show the
 * work, then say when you are free.
 */
const ITEMS: readonly VendorNavItem[] = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendor/profile/edit', label: 'Business profile', icon: Store },
  { href: '/vendor/packages', label: 'Packages', icon: Package },
  { href: '/vendor/portfolio', label: 'Portfolio', icon: Images },
  { href: '/vendor/availability', label: 'Availability', icon: CalendarDays },
];

/**
 * The vendor's own navigation. A fixed rail from `lg` up, where the design
 * calls for a sidebar beside the content; below that it collapses to a
 * horizontally scrollable strip rather than stacking five full-width rows and
 * spending a third of a small screen before the page begins.
 */
export function VendorNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Vendor"
      className="border-b border-stone-150 bg-card lg:border-r lg:border-b-0"
    >
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:sticky lg:top-(--header-height) lg:flex-col lg:h-[calc(100dvh-var(--header-height))] lg:overflow-visible lg:px-3 lg:py-6">
        {ITEMS.map((item) => {
          // Prefix matching, so a nested route keeps its section highlighted.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  // 44px tall below `lg`, where the input is a finger.
                  'flex min-h-11 items-center gap-2 rounded-md px-3 py-2.5 text-sm whitespace-nowrap transition-colors duration-(--duration-fast) lg:min-h-0 lg:py-2',
                  isActive
                    ? 'bg-primary-50 font-medium text-primary-600'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800',
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
