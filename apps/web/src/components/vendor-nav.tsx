'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Images,
  LayoutDashboard,
  Package,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VendorNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Ordered the way a vendor sets a business up: describe it, price it, show the
 * work, say when you are free, then connect the account that gets paid.
 */
/** The one vendor route that supplies its own rail. */
const EDITOR_PATH = '/vendor/profile/edit';

const ITEMS: readonly VendorNavItem[] = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // `16-vendor-dashboard.md` puts Bookings in the sidebar: accepting a request
  // has to lead somewhere, and this is where the vendor's committed work lives.
  { href: '/vendor/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/vendor/profile/edit', label: 'Business profile', icon: Store },
  { href: '/vendor/packages', label: 'Packages', icon: Package },
  { href: '/vendor/portfolio', label: 'Portfolio', icon: Images },
  { href: '/vendor/availability', label: 'Availability', icon: CalendarDays },
  /*
   * `Payments`, not `Payouts`: that is the word frame `08` puts in this rail,
   * and the nav item is the frame's string even though the copy inside the
   * screen talks about payouts. Last, because it is the step a vendor takes
   * once the storefront is worth booking.
   */
  { href: '/vendor/payments', label: 'Payments', icon: CreditCard },
];

/**
 * The vendor's own navigation. A fixed rail from `lg` up, where the design
 * calls for a sidebar beside the content; below that it collapses to a
 * horizontally scrollable strip rather than stacking five full-width rows and
 * spending a third of a small screen before the page begins.
 */
export function VendorNav(): React.ReactElement | null {
  const pathname = usePathname();

  /*
   * The storefront editor carries its own 200px section rail, and frame `09`
   * shows one rail on that screen, not two. Returning null lets the layout's
   * flex row collapse rather than leaving an empty column behind.
   */
  if (pathname.startsWith(EDITOR_PATH)) {
    return null;
  }

  return (
    <nav
      aria-label="Vendor"
      className={
        /*
         * `box-content` from `lg` is the whole of this fix. The frames' `.side`
         * is content-box — 240px of content plus 12px gutters and a 1px right
         * border, a 265px footprint — while Tailwind is border-box, so the same
         * 240px token was swallowing its own padding and border and rendering
         * 25px narrow.
         *
         * Both steps are the frames' own arithmetic. `.side` is 240px on a
         * 12px gutter, so 240 + 12 + 12 + 1 = 265 — the footprint frames `08`
         * and `11` draw. Frame `27 Vendor dashboard — 1024` overrides it to
         * `width:220px; padding:14px 10px`, so 220 + 10 + 10 + 1 = 241. The
         * gutter is therefore a step too, not a constant: `lg:px-2.5` at 1024
         * and `px-3` at 1440. The 225 this comment used to cite is the
         * *editor's* section rail in `vendor-profile-form.tsx`, a different
         * component that is not `box-content` at all.
         *
         * The gutters sit here rather than on the list because that is where
         * the frame puts them, and because `box-content` can only add padding
         * the element itself declares: with them on the `ul` the nav measured
         * 241px, its border and nothing else.
         */
        'border-b border-stone-300 bg-stone-0 lg:box-content lg:w-(--sidebar-width-md) lg:shrink-0 lg:border-r lg:border-b-0 lg:px-2.5 min-[90rem]:w-(--sidebar-width) min-[90rem]:px-3'
      }
    >
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:sticky lg:top-(--header-height) lg:flex-col lg:h-[calc(100dvh-var(--header-height))] lg:overflow-visible lg:px-0 lg:py-3.5 min-[90rem]:py-4">
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
                  /*
                    44px tall below `lg`, where the input is a finger. Above it
                    the item is the frames' `.nav`: 8px/11px at 13px in frame
                    `27 Vendor dashboard — 1024`, 9px/12px at 13.5px in the base
                    rule frames `08` and `11` use. It was a flat 10px/12px at
                    13.5px, which is the 1440 value with a pixel of its own
                    invention.
                  */
                  'flex min-h-11 items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-base font-medium whitespace-nowrap transition-colors duration-(--duration-fast) lg:min-h-0 lg:px-2.75 lg:py-2 lg:text-[13px] min-[90rem]:px-3 min-[90rem]:py-2.25 min-[90rem]:text-base',
                  isActive
                    ? 'bg-clay-100 font-semibold text-clay-600 shadow-[inset_3px_0_0_var(--color-clay-400)]'
                    : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
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
