import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BookingsSidebarProps {
  bookingCount: number;
  /**
   * Whether any thread has messages the customer has not read. Frame `07` draws
   * a clay dot on the `Messages` row and nothing else — no count — so this is a
   * boolean rather than a number the row would have to render.
   */
  hasUnreadMessages?: boolean;
  /** Which entry is the current page. */
  current: 'bookings' | 'profile';
}

/**
 * The 240px sidebar of frame `07`.
 *
 * The frame draws four rows: **My bookings** (count) · **Messages** (unread
 * dot) · **Saved vendors** · **My profile**.
 *
 * **`Messages` is now built.** It was held out under #31's rule that a control
 * which opens nothing is furniture, because messaging did not exist; `/messages`
 * ships and the site header already links it, so the rule has expired for this
 * row and the frame gets its dot.
 *
 * **`Saved vendors` is still out, and for the same reason as before.** There is
 * no saved-vendor feature anywhere in the product — no route, no schema, no
 * endpoint — so the row could only be a link to a 404. It returns with the
 * surface it leads to.
 */
export function BookingsSidebar({
  bookingCount,
  hasUnreadMessages = false,
  current,
}: BookingsSidebarProps): React.ReactElement {
  const items = [
    {
      key: 'bookings' as const,
      label: 'My bookings',
      href: '/bookings',
      count: bookingCount,
      dot: false,
    },
    {
      key: 'messages' as const,
      label: 'Messages',
      href: '/messages',
      count: null,
      dot: hasUnreadMessages,
    },
    {
      key: 'profile' as const,
      label: 'My profile',
      href: '/customer/profile',
      count: null,
      dot: false,
    },
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
              {/*
                The frame's 7px clay dot, right-aligned in the row. Named in the
                accessible name rather than drawn alone: a colour-only signal is
                the `04-laws.md` case the six laws exist for, and a screen reader
                reaching this row would otherwise hear the same thing whether or
                not anything was waiting.
              */}
              {item.dot ? (
                <>
                  <span
                    aria-hidden="true"
                    className="ml-auto size-1.75 shrink-0 rounded-full bg-clay-400"
                  />
                  <span className="sr-only">unread</span>
                </>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {/*
        11.5px body over a 12px link — frame `07` draws `font-size:11.5px` on
        the sentence and `12px` on `Find a vendor →`, where both read `text-xs`'s
        11. The title above is already the frame's 12.5px/600.
      */}
      <div className="mt-auto rounded-xl bg-stone-150 p-3">
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
