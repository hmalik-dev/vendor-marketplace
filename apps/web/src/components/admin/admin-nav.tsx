'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface AdminNavProps {
  /** The count frame `13` draws beside `Reviews` — a query result, never a guess. */
  reviewCount: number;
  /**
   * Open cases (#431). The same treatment, for a better reason: an unreviewed
   * review is somebody waiting for an opinion, and an open case is somebody's
   * payout frozen. Read the cheap way the layout documents — `pageSize=1` for
   * the `total` — not through `/admin/metrics`.
   */
  caseCount: number;
}

/**
 * The order frame `13 Admin` draws, extended by the two rows it does not:
 * the shape of the platform first, then the two sides of it, then what they
 * transacted and what is disputed about it, then the money, then what they
 * said, then the vocabulary that files it all.
 *
 * **`Cases` sits directly after `Bookings` — ruled 2026-09-07 by the admin
 * delta (#454), overturning #431.** A case is always *about* a booking, so the
 * rail reads in the order the work arrives rather than in the order the money
 * does. #431 had put it between `Payments` and `Reviews` on the argument that
 * it is money; that argument is recorded in `22-admin.md` as what was
 * overturned, and is deliberately not restated here as a live one.
 *
 * **Nine rows before the move and nine after — it is an order change, not a
 * count change.** The delta's own preamble reasons from a stale brief of eight
 * rows and concludes the rail "needs nine so Cases can carry a badge"; #431 had
 * already given Cases its row. A reader who takes that preamble literally adds
 * a tenth.
 *
 * **`Activity` is a row the frame does not draw**, added with #434 and ruled
 * into `22-admin.md`'s rail — the same direction D30 settled when the frame and
 * that file disagreed about the row count. It sits last because it is the only
 * item that is not a working surface: nothing here is acted on, it is what the
 * others leave behind. The rail scrolls (`lg:overflow-y-auto`), so it costs no
 * composition.
 *
 * **`/admin/requests` gets no row.** The delta rules it a tab inside `Bookings`
 * — a request is a booking before it exists — and that surface is #437's.
 *
 * Not exported, and the order is asserted by *rendering* the rail rather than
 * by grepping this file: a `toContain` over the source matches the prose above
 * as readily as the array, so a source guard for "Cases sits after Bookings"
 * passes on the sentence that says so and cannot fail for a row in the wrong
 * place.
 */
const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/cases', label: 'Cases' },
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
export function AdminNav({ reviewCount, caseCount }: AdminNavProps): React.ReactElement {
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

          /*
           * One expression rather than a condition per badge. Two adjacent
           * `label === '…' && count > 0` clauses is how the second one comes to
           * be pasted with the first one's count still in it.
           */
          const badge =
            item.label === 'Reviews' ? reviewCount : item.label === 'Cases' ? caseCount : 0;

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
                {badge > 0 ? (
                  <span className="ml-auto rounded-full bg-clay-400 px-1.75 py-px text-xs font-bold text-stone-0">
                    {badge}
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
