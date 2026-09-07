'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface AdminNavProps {
  /** The count frame `13` draws beside `Reviews` — a query result, never a guess. */
  reviewCount: number;
}

/**
 * The order frame `13 Admin` draws, which is also the order an operator works
 * in: the shape of the platform first, then the two sides of it, then what they
 * transacted, then what they said, then the vocabulary that files it all.
 *
 * **Activity is an eighth row the frame does not draw**, added with #434 and
 * ruled into `22-admin.md`'s rail, which is the spec the frame answers to — the
 * same direction D30 settled when the frame and that file disagreed about the
 * row count. It sits last because it is the only item that is not a working
 * surface: nothing here is acted on, it is what the other seven leave behind.
 * The rail scrolls (`lg:overflow-y-auto`), so an eighth row costs nothing.
 */
const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/tags', label: 'Categories & tags' },
  { href: '/admin/activity', label: 'Activity' },
] as const;

/**
 * The console's 210px rail.
 *
 * `.side` is content-box in the frames — 210px of content on a 12px gutter and
 * a 1px right border — so `box-content` is what makes the same token measure
 * the footprint the frame draws rather than 25px narrow. Same arithmetic as
 * `VendorNav`, and the same reason.
 *
 * A row is the frame's `.nav` box from `lg` up: 9px of padding either side of a
 * 13.5px line box, 34px, with no gap between rows. `min-h-11` is released there
 * (`lg:min-h-0`) — it made every row 44px and, with `gap-1`, a 48px pitch, which
 * ended the rail 93px below where frame `13` draws it (#392). It survives below
 * `lg`, where the rail is a horizontal touch strip and `04-laws.md`'s target
 * size is the governing constraint rather than a frame nothing draws.
 */
export function AdminNav({ reviewCount }: AdminNavProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="border-b border-stone-300 bg-stone-0 px-3 py-2 lg:box-content lg:w-(--sidebar-admin-width) lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-4"
    >
      {/*
        A rail from `lg` up, where frame `13` draws one. Below that it is a
        horizontally scrollable strip rather than seven stacked full-width rows,
        which would spend most of a small screen before the table begins.

        `lg:gap-0` because `.side` sets no gap: an item's pitch in the frame *is*
        its height. Below `lg` the strip keeps `gap-1`, where nothing is drawn to
        match and the rows read as separate targets rather than one bar.
      */}
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
        {ITEMS.map((item) => {
          /*
           * Exact match for Overview, prefix for the rest. `/admin` is a prefix
           * of every other route here, so a prefix test would light Overview up
           * on all seven screens.
           */
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-[9px] px-3 py-2.25 text-base font-medium whitespace-nowrap transition-colors duration-(--duration-fast) lg:min-h-0',
                  isActive
                    ? 'bg-clay-100 font-semibold text-clay-600 shadow-[inset_3px_0_0_var(--color-clay-400)]'
                    : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                {item.label}
                {item.label === 'Reviews' && reviewCount > 0 ? (
                  <span className="ml-auto rounded-full bg-clay-400 px-1.75 py-px text-xs font-bold text-stone-0">
                    {reviewCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
