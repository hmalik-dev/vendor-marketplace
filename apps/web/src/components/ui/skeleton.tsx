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
 * The search grid's card while its data is in flight: 3:2 cover, name, meta
 * line, the (empty) chip row, then the ruled From/price row.
 *
 * **Every measurement here is `VendorCard`'s at `density="compact"`, not a
 * frame's.** That distinction is the whole point of this component and it was
 * got wrong twice. Three generic bars left the body 60px short of the card;
 * rebuilding it from frame `17 Search loading` left it 14px short, because
 * frame `17` is a 1440 frame drawn in the **1024 composition** — three columns,
 * 450px cards, a fixed 152px cover — while the loaded state at that width
 * (`02 Search`) is four columns at 335px on a 3:2 ratio. The two frames
 * disagree with each other by 25px of card body, so neither can be copied
 * blind. A skeleton's contract is with the component it becomes, and only the
 * component can settle it.
 *
 * Measured in the browser at 1440x900, both states held on screen (the search
 * request was intercepted and never resolved, because a skeleton that resolves
 * before it paints proves nothing):
 *
 * ```
 * loaded card 350.328  body 127 = 12 + 11 + 25 + 2 + 15 + 8 + 0 + 10 + 30 + 14
 * skeleton    350.328  body 127   same terms, same order
 * ```
 *
 * **The chip row is deliberately empty**, and that is the surprise. `VendorCard`
 * renders *no* category chip in compact — the search grid is already filtered to
 * one vendor type, so a chip would restate the query — and the availability chip
 * is never passed here either. The row is a zero-height flex container that
 * still costs its 8px `margin-top`, so it is reproduced rather than folded into
 * a magic number: if the card ever gains a chip, this is where the skeleton
 * gains one too. Frame `17` draws two chips because it draws the 1024 card,
 * which does render them.
 *
 * The bar heights are the card's own line boxes (25 / 15 / 15 / 20), which are
 * font-metric-derived rather than round because every one of those steps is
 * `line-height: normal`. The widths are placeholders and are the median of
 * frame `17`'s six cards — it varies them so a column does not read as
 * identical boxes, and a single component cannot vary.
 *
 * `rounded-[16px]`, not `rounded-2xl`: this was 18px against the card's own 16,
 * so the corner changed shape as the data landed.
 */
export function VendorCardSkeleton({ className }: { className?: string }): React.ReactElement {
  return (
    <div
      data-slot="skeleton-vendor-card"
      className={cn('overflow-hidden rounded-[16px] bg-stone-0 shadow-sm', className)}
    >
      <Skeleton className="aspect-[3/2] w-full rounded-none" />

      {/* `px-3.5 pt-3 pb-3.5` — the compact card's own asymmetric padding. */}
      <div className="px-3.5 pt-3 pb-3.5">
        {/* The `<h3>`: 19px Instrument Serif, whose line box measures 25. */}
        <Skeleton className="mt-2.75 h-[25px] w-[61%]" />
        {/* The rating · location line: `text-meta`, 12px, line box 15. */}
        <Skeleton className="mt-0.5 h-[15px] w-[47%]" />

        {/*
          The chip row, empty exactly as the loaded card's is. It contributes no
          height and its `margin-top` is part of the body's rhythm.
        */}
        <div aria-hidden="true" className="mt-2 flex flex-wrap gap-1.25" />

        {/*
          The price row carries the rule as its own `border-t`, the way the card
          does — not a separate divider element with symmetric margins, which is
          what put 4px of the old drift here.

          `items-center`, where the card uses `items-baseline`: these are bars
          with no text, so they have no baseline to align and the flex container
          would resolve one from their bottom edges. Centring keeps the row's
          height at its tallest child, which is the 20px price.
        */}
        <div className="mt-2.5 flex items-center justify-between border-t border-stone-200 pt-2.25">
          <Skeleton className="h-[15px] w-9" />
          <Skeleton className="h-[20px] w-[61px]" />
        </div>
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
