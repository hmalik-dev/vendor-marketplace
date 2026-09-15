import Link from 'next/link';
import { cn } from '@/lib/utils';

export type BookingsTab = 'bookings' | 'requests';

/** Each tab is its own route, so a view is a URL an operator can paste. */
const TABS: readonly { key: BookingsTab; label: string; href: string }[] = [
  { key: 'bookings', label: 'Bookings', href: '/admin/bookings' },
  { key: 'requests', label: 'Requests', href: '/admin/requests' },
];

/**
 * `Bookings · Requests` (VEN-399).
 *
 * The admin delta rules requests a tab of Bookings rather than a rail row — a
 * request is a booking before it exists, and an operator reaches it while
 * looking at bookings. Drawn in the title row beside the heading, so the
 * shell frame `13` measures keeps its height and its fifteen rows.
 */
export function BookingsTabs({ current }: { current: BookingsTab }): React.ReactElement {
  return (
    <nav aria-label="Bookings views" className="self-center">
      <ul className="flex gap-1">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === current ? 'page' : undefined}
              className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium transition-colors duration-(--duration-fast)',
                tab.key === current
                  ? 'bg-clay-100 font-semibold text-clay-600'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
