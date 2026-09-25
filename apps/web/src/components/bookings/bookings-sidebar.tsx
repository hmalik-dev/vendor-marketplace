import Link from 'next/link';
import { MessagesUnreadDot } from '@/components/bookings/messages-unread-dot';
import { cn } from '@/lib/utils';

export interface BookingsSidebarProps {
  /** `null` while the count is still being read: the row draws no number rather than a guess. */
  bookingCount: number | null;
  /** Which entry is the current page. */
  current: 'bookings' | 'messages';
}

const ITEMS = [
  { key: 'bookings', label: 'My bookings', href: '/bookings' },
  { key: 'messages', label: 'Messages', href: '/messages' },
] as const;

/**
 * The 240px sidebar of frame `07`, shared by the customer's `/bookings` and
 * `/messages` (VEN-745).
 *
 * The frame draws four rows: **My bookings** (count) · **Messages** (unread
 * dot) · **Saved vendors** · **My profile**. The app builds the first two, by
 * the account holder's ruling of 2026-09-24:
 *
 * - **`Saved vendors`** has no feature behind it — no route, no schema, no
 *   endpoint — so the row could only be a link to a 404.
 * - **`My profile`** stays in the account menu and drawer, where it already is.
 *
 * `frame-08-nav-parity.test.ts` pins both omissions so neither returns as a
 * "fix". The unread dot is the header link's own state, read from the store it
 * publishes (`MessagesUnreadDot`); the row opens no stream and fetches nothing.
 */
export function BookingsSidebar({
  bookingCount,
  current,
}: BookingsSidebarProps): React.ReactElement {
  return (
    <nav
      aria-label="Your account"
      className="hidden w-60 shrink-0 flex-col border-r border-stone-300 bg-stone-0 px-3 py-4 lg:flex"
    >
      <ul className="flex flex-col">
        {ITEMS.map((item) => {
          const isCurrent = item.key === current;

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-[9px] px-3 py-2.25 text-base font-medium',
                  isCurrent
                    ? 'bg-clay-100 font-semibold text-clay-600 shadow-[inset_3px_0_0_var(--color-clay-400)]'
                    : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                {item.label}
                {item.key === 'bookings' && bookingCount !== null ? (
                  <span className="ml-auto text-helper font-semibold text-stone-600">
                    {bookingCount}
                  </span>
                ) : null}
                {item.key === 'messages' ? <MessagesUnreadDot /> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/*
        11.5px body over a 12px link — frame `07` draws `font-size:11.5px` on
        the sentence and `12px` on `Find a vendor →`, where both read `text-xs`'s
        11. The title above is already the frame's 12.5px/600.
      */}
      <div className="mt-auto rounded-panel bg-stone-150 p-3">
        <p className="mb-1 text-sm font-semibold text-stone-900">Booking for something new?</p>
        <p className="mb-2.25 text-helper leading-normal text-stone-700">
          Search by vendor type, city and date — availability is live.
        </p>
        <Link href="/search" className="text-meta font-semibold text-clay-500 hover:underline">
          Find a vendor →
        </Link>
      </div>
    </nav>
  );
}
