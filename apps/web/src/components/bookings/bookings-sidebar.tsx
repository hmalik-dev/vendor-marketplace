import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BookingsSidebarProps {
  bookingCount: number;
  /** Which entry is the current page. */
  current: 'bookings' | 'profile';
}

/**
 * The 240px sidebar of frame `07`.
 *
 * The frame also draws **Messages** and **Saved vendors**. Neither exists —
 * messaging is #8 and there is no saved-vendor feature at all — and #31's rule
 * is that a control which opens nothing is furniture. They return with the
 * surfaces they lead to rather than shipping as dead links.
 */
export function BookingsSidebar({
  bookingCount,
  current,
}: BookingsSidebarProps): React.ReactElement {
  const items = [
    { key: 'bookings' as const, label: 'My bookings', href: '/bookings', count: bookingCount },
    { key: 'profile' as const, label: 'My profile', href: '/customer/profile', count: null },
  ];

  return (
    <nav
      aria-label="Your account"
      className="hidden w-60 shrink-0 flex-col border-r border-stone-300 bg-stone-0 px-3 py-4 lg:flex"
    >
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.key === current ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-[9px] px-3 py-2.25 text-base font-medium',
                item.key === current
                  ? 'bg-clay-100 font-semibold text-clay-600 shadow-[inset_3px_0_0_var(--color-clay-400)]'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
              )}
            >
              {item.label}
              {item.count === null ? null : (
                <span className="ml-auto text-xs text-stone-600">{item.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-auto rounded-xl bg-stone-150 p-3">
        <p className="mb-1 text-sm font-semibold text-stone-900">Booking for something new?</p>
        <p className="mb-2.25 text-xs leading-[1.5] text-stone-700">
          Search by vendor type, city and date — availability is live.
        </p>
        <Link href="/search" className="text-xs font-semibold text-clay-500 hover:underline">
          Find a vendor →
        </Link>
      </div>
    </nav>
  );
}
