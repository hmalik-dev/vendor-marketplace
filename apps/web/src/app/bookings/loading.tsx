import { BookingCardSkeleton } from '@/components/ui/skeleton';

/**
 * The bookings hub while its requests and bookings are in flight.
 *
 * **The chrome stays drawn.** The pane, the heading and the tab row are known
 * before the data is, so redrawing them as skeletons would claim the page is
 * still deciding what it is. Only the cards are unknown, so only the cards are
 * skeletons — and they are `BookingCard`'s own measurements, so nothing on the
 * screen moves when the real ones arrive.
 *
 * Nine cards: three full rows of the `lg` grid, which fills the pane at 1440
 * without implying a count the customer does not have.
 */
export default function BookingsLoading(): React.ReactElement {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5.5">
        <h1 className="mb-0.5 font-display text-[26px] tracking-[-.01em] text-stone-900">
          Your bookings
        </h1>
        {/*
          The summary line names a count and a next booking, and both are
          exactly what is not known yet — so it is a skeleton rather than a
          guess, and never "0 bookings" before the answer arrives.
        */}
        <div className="mb-4 flex h-6 items-center">
          <span className="skeleton-surface block h-3.5 w-72 rounded-md" aria-hidden="true" />
        </div>

        <div className="mb-3.5 flex items-center justify-between border-b border-stone-300">
          <div className="flex gap-6 pb-2.25" aria-hidden="true">
            {['Upcoming', 'History', 'All'].map((label) => (
              <span key={label} className="inline-block py-2.25 text-base text-stone-600">
                {label}
              </span>
            ))}
          </div>
        </div>

        <ul
          aria-busy="true"
          aria-label="Loading your bookings"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 9 }, (_, index) => (
            <BookingCardSkeleton key={index} />
          ))}
        </ul>
      </div>
    </div>
  );
}
