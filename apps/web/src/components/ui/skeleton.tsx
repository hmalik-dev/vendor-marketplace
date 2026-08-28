import { cn } from '@/lib/utils';

/**
 * Content loading is skeletons, always — one variant per content type,
 * mirroring the real dimensions so the layout doesn't jump when data lands.
 * Never a spinner and a skeleton on the same screen.
 *
 * See design/design-plan/03-components.md.
 */
export function Skeleton({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('skeleton-surface block rounded-md', className)}
    />
  );
}

/**
 * A vendor card's shape: 3:2 cover, name, meta row, chips, price row.
 *
 * The cover ratio has to be the card's own, or the grid reflows the moment the
 * data lands — which is the one thing a skeleton exists to prevent.
 */
export function VendorCardSkeleton({ className }: { className?: string }): React.ReactElement {
  return (
    <div
      data-slot="skeleton-vendor-card"
      className={cn('overflow-hidden rounded-2xl bg-stone-0 shadow-sm', className)}
    >
      <Skeleton className="aspect-[3/2] w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

/** A 56px app row. */
export function RowSkeleton(): React.ReactElement {
  return (
    <div data-slot="skeleton-row" className="flex h-(--row-height) items-center gap-3 px-4">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-3.5 flex-1" />
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}

/**
 * A booking card's shape, for the bookings hub while its data is in flight.
 *
 * Every measurement is `BookingCard`'s own — the 9.5 avatar tile, the status
 * pill's height, the 17px display name, the 21px date. A generic grey box would
 * be a defect: the grid is three columns wide, so a skeleton that guesses moves
 * every card on the screen the moment the real data lands, which is the one
 * thing a skeleton exists to prevent.
 */
export function BookingCardSkeleton(): React.ReactElement {
  return (
    <li data-slot="skeleton-booking-card" className="rounded-[14px] bg-stone-0 p-3.5 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="size-9.5 rounded-[9px]" />
        <Skeleton className="h-5.5 w-20 rounded-full" />
      </div>
      {/* Name, then the category · occasion line. */}
      <Skeleton className="mt-2.5 h-5 w-2/3" />
      <Skeleton className="mt-1 h-3 w-1/2" />
      {/* The date, which is the card's largest type, then its sub-line. */}
      <Skeleton className="mt-2.75 h-6 w-3/5" />
      <Skeleton className="mt-1 h-3 w-2/5" />
    </li>
  );
}

/**
 * A message bubble's shape, for a thread that has not arrived yet.
 *
 * Both of the real bubble's rules are kept, because either one alone stops it
 * reading as a conversation: bubbles never exceed 62% of the pane, and the
 * tail is a single squared corner on the sender's side. A column of identical
 * full-width blocks would read as a form.
 */
export function MessageBubbleSkeleton({ mine = false }: { mine?: boolean }): React.ReactElement {
  return (
    <div
      data-slot="skeleton-message-bubble"
      className={cn('flex max-w-[62%] flex-col', mine ? 'self-end' : 'self-start')}
    >
      <Skeleton
        className={cn(
          'h-11.5 w-56',
          mine ? 'rounded-[14px_14px_4px_14px]' : 'rounded-[14px_14px_14px_4px]',
        )}
      />
      {/* The attribution line under every bubble. */}
      <Skeleton className={cn('mt-1 h-3 w-24', mine ? 'self-end' : 'self-start')} />
    </div>
  );
}
