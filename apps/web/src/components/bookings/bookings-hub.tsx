import Link from 'next/link';
import {
  FALLBACK_TONES as AVATAR_FALLBACK_TONES,
  avatarToneIndex,
  initialsFor,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyStateGlyph } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import {
  applyRefinements,
  categoryNamesOf,
  entriesForTab,
  formatCardDate,
  groupByMonth,
  summarise,
  type BookingEntry,
  type BookingSort,
  type BookingTab,
} from '@/lib/booking-entries';
import { BookingsRefineChips } from './bookings-refine-chips';
import { cn } from '@/lib/utils';

export const BOOKING_TABS: readonly BookingTab[] = ['upcoming', 'history', 'all'];

const TAB_LABELS: Record<BookingTab, string> = {
  upcoming: 'Upcoming',
  history: 'History',
  all: 'All',
};

const SEARCH_MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

interface BookingCardProps {
  entry: BookingEntry;
}

/**
 * One booking, at a glance.
 *
 * **The date is the largest element**, in Serif at 21px, because it is what
 * gets scanned — the vendor's name above it is how you tell two apart once the
 * date has found the row.
 */
function BookingCard({ entry }: BookingCardProps): React.ReactElement {
  const body = (
    <>
      <div className="flex items-start justify-between">
        {entry.vendorImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vendor bucket is not in the image config (#47)
          <img src={entry.vendorImageUrl} alt="" className="size-9.5 rounded-[9px] object-cover" />
        ) : (
          /*
            A monogram, not a blank swatch. `40-states.md` is explicit that "a
            generic grey box is a bug", and #81's second finding was this
            rendering on all eleven cards while `/search` and `/messages`
            already drew initials for the same vendors.

            Not the `Avatar` component itself: this tile is the card's 9px
            squircle and `Avatar` is unconditionally `rounded-full`. The
            initials and the tone come from `Avatar`'s own helpers, so a vendor
            keeps one colour and one monogram everywhere they appear.
          */
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9.5 items-center justify-center rounded-[9px] text-[13px] font-semibold',
              AVATAR_FALLBACK_TONES[avatarToneIndex(entry.vendorName)],
            )}
          >
            {initialsFor(entry.vendorName)}
          </span>
        )}
        <StatusPill tone={entry.statusTone}>{entry.statusLabel}</StatusPill>
      </div>
      <p className="mt-2.5 truncate font-display text-[17px] text-stone-900">{entry.vendorName}</p>
      <p className="mt-0.5 truncate text-xs text-stone-600">
        {[entry.categoryName, entry.occasion].filter(Boolean).join(' · ') || ' '}
      </p>
      <p className="mt-2.25 font-display text-[21px] text-stone-900">
        {formatCardDate(entry.eventDate)}
      </p>
      <p className="truncate text-helper text-stone-600">{entry.subline}</p>
    </>
  );

  const className =
    'block rounded-[14px] bg-stone-0 p-3.5 shadow-sm transition-shadow hover:shadow-hover';

  /*
   * **The request, not the storefront.** Every card here linked to
   * `/vendors/<slug>` — a marketing page whose only controls are `Request
   * booking` and `Send a message`. So a customer opening the request they sent
   * arrived somewhere offering to send it again, with no route to the thing
   * they came for: the quote, the payment, or withdrawing it.
   *
   * The rail's `Review quote` link was corrected when that surface was built.
   * The cards were not, and they are how everything that is not a live quote
   * is reached — every `pending`, `accepted` and settled row on the page.
   *
   * A settled row still goes to its own detail: "what did I agree to, and what
   * happened to it" is exactly what a customer opens a finished booking for.
   * **Every row has one now** — the fallback this used to describe is gone
   * with the `null` below it (#400).
   */
  /*
   * **A booking links to its request's detail page** (#400).
   *
   * This used to be `null` for a booking, under a comment saying the row "has
   * no detail route of its own yet". The route exists — `/bookings/<requestId>`
   * renders the negotiation and its outcome, and is the only surface carrying
   * `View confirmation` and `Cancel booking` — and `requestId` was already on
   * the wire object, since `paidRequestIds` is built from it. So the customer's
   * confirmed booking was a dead card: after checkout there was no route back
   * to it by navigation at all.
   */
  const href = `/bookings/${entry.requestId}`;

  return (
    <li>
      <Link href={href} className={className}>
        {body}
      </Link>
    </li>
  );
}

interface BookAnotherProps {
  /** The last booked date in the group — what the frame's sub-line names. */
  date: string;
  city: string | null;
}

/**
 * An invitation at the end of the last group, not a checklist item.
 *
 * It replaced a to-do list of unbooked categories, which invented an
 * obligation the customer never agreed to — this offers the next step without
 * implying one is missing.
 */
function BookAnother({ date, city }: BookAnotherProps): React.ReactElement {
  const params = new URLSearchParams({ date });
  if (city) {
    params.set('city', city);
  }

  return (
    <li>
      <Link
        href={`/search?${params.toString()}`}
        className="flex h-full flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-stone-400 bg-stone-0 p-3.5 text-center transition-colors hover:bg-stone-100"
      >
        <span
          aria-hidden="true"
          className="flex size-6.5 items-center justify-center rounded-full bg-stone-150 text-[15px] text-stone-600"
        >
          +
        </span>
        <span className="text-action font-semibold text-stone-900">Book another vendor</span>
        <span className="text-helper text-stone-600">
          Search {SEARCH_MONTH.format(new Date(`${date}T00:00:00Z`))}
          {city ? ` in ${city}` : ''}
        </span>
      </Link>
    </li>
  );
}

export interface BookingsHubProps {
  entries: readonly BookingEntry[];
  tab: BookingTab;
  today: string;
  /** Pre-fills the "book another" search; the customer's own city, if set. */
  city: string | null;
  /** Entries waiting on the customer, for the widths where the rail is hidden. */
  needsYou: readonly BookingEntry[];
  /** The Refine chips' state, read from the URL by the page. */
  category: string | null;
  sort: BookingSort;
}

/**
 * Frame `07`. Every booking the customer has ever made, grouped by the month
 * its date falls in.
 *
 * **There is no Event entity and nothing here assumes one.** The month header
 * is derived from the booking date and is purely presentational — there is no
 * object behind it to open, which is why it carries a count and no link.
 */
export function BookingsHub({
  entries,
  tab,
  today,
  city,
  needsYou,
  category,
  sort,
}: BookingsHubProps): React.ReactElement {
  /*
   * Tab first, then the chips. The tab counts and the summary sentence are taken
   * from the unrefined list on purpose — a category filter narrows what is
   * *shown*, and a tab whose count moved because of a filter would be reporting
   * the filter rather than the tab.
   */
  const tabEntries = entriesForTab(entries, tab, today);
  /*
   * The chip's options come from **this tab**, not from every booking. Offering
   * a category the tab does not hold recreates #187's own defect in a subtler
   * shape: `applyRefinements` correctly drops a filter that matches nothing, so
   * picking one of those offered categories left the full tab on screen under a
   * chip naming the category it was supposedly filtered to.
   */
  const categoryNames = categoryNamesOf(tabEntries);
  /*
   * And the label is the *applied* filter, never the raw param. `?category=` is
   * URL input: it can name a category this customer does not hold, or arrive
   * whitespace-padded. Resolving it here is what keeps the chip and the list
   * telling the same story.
   */
  const appliedCategory = category !== null && categoryNames.includes(category) ? category : null;

  const visible = applyRefinements(tabEntries, { category: appliedCategory, sort });
  const groups = groupByMonth(visible);
  const summary = summarise(entries, today);

  const counts: Record<BookingTab, number> = {
    upcoming: entriesForTab(entries, 'upcoming', today).length,
    history: entriesForTab(entries, 'history', today).length,
    all: entries.length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5.5">
      <h1 className="mb-0.5 display-heading text-[26px] text-stone-900">Your bookings</h1>
      <p className="mb-4 text-md leading-prose text-stone-700">
        {summary ? (
          <>
            {summary.count} upcoming {summary.count === 1 ? 'booking' : 'bookings'}. Next up is{' '}
            <strong className="font-semibold">{summary.nextVendor}</strong>{' '}
            {summary.inDays === 0
              ? 'today'
              : `in ${summary.inDays} ${summary.inDays === 1 ? 'day' : 'days'}`}
            .
          </>
        ) : (
          'Nothing coming up. Requests you send land here as soon as you send them.'
        )}
      </p>

      {/*
        The rail is hidden below `xl` for width, and a quote waiting on the
        customer is the one thing that must not disappear with it — so it moves
        into the column instead of being dropped.
      */}
      {needsYou.length > 0 ? (
        <ul className="mb-3.5 flex flex-col gap-2 xl:hidden">
          {needsYou.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-clay-100 px-3.5 py-2.5"
            >
              <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-clay-400" />
              <span className="text-base font-semibold text-stone-900">
                {entry.vendorName} sent a quote
              </span>
              <span className="text-sm text-stone-700">{entry.subline}</span>
              {/*
                The request, not the storefront. This pointed at
                `/vendors/<slug>` — a page whose only controls are `Request
                booking` and `Send a message`, so the customer arrived at a
                marketing page with no way to accept the quote they came to
                accept.
              */}
              <Link
                href={`/bookings/${entry.id}`}
                className="ml-auto text-sm font-semibold text-clay-500 hover:underline"
              >
                Review quote
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mb-3.5 flex items-center justify-between border-b border-stone-300">
        <nav aria-label="Booking status">
          <ul className="flex gap-6">
            {BOOKING_TABS.map((name) => (
              <li key={name}>
                <Link
                  /*
                    The sort travels; the category does not. A sort order is a
                    reading preference and holds across tabs, but a category is
                    now scoped to the tab that holds it — carrying `Catering`
                    from History into Upcoming would name a filter that cannot
                    apply there, which is the mismatch this ticket just closed.
                  */
                  href={`/bookings?tab=${name}${sort === 'soonest' ? '' : `&sort=${sort}`}`}
                  aria-current={name === tab ? 'page' : undefined}
                  className={cn(
                    'inline-block py-2.25 text-base',
                    name === tab
                      ? 'font-semibold text-stone-900 shadow-[inset_0_-2px_0_var(--color-clay-400)]'
                      : 'font-medium text-stone-600 hover:text-stone-900',
                  )}
                >
                  {TAB_LABELS[name]}{' '}
                  {name === 'all' ? null : (
                    <span className="font-medium text-stone-600">{counts[name]}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <BookingsRefineChips
          tab={tab}
          categories={categoryNames}
          category={appliedCategory}
          sort={sort}
        />
      </div>

      {/*
        `px-1 -mx-1` is the focus ring's clearance, not spacing. This scroller is
        the nearest clipping ancestor and its content box started exactly at the
        first column's left edge, so the card's 4px outward
        `ring-offset-2 + ring-2` was clipped away on that side — three sides drawn
        and the fourth missing, which `04-laws.md` counts as a partial failure of
        the visible-focus law. The negative margin widens the clip box by the
        same 4px the padding puts back, so nothing moves and the ring fits.
      */}
      <div className="min-h-0 flex-1 -mx-1 overflow-y-auto px-1 pb-5">
        {groups.length === 0 ? (
          <EmptyBookings />
        ) : (
          groups.map((group, index) => (
            <section key={group.key} className={index > 0 ? 'mt-5' : undefined}>
              <div className="mb-2.5 flex items-center gap-3">
                <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">
                  {group.label}
                </h2>
                <span aria-hidden="true" className="h-px flex-1 bg-stone-300" />
                <span className="text-helper text-stone-600">
                  {group.entries.length} {group.entries.length === 1 ? 'booking' : 'bookings'}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.entries.map((entry) => (
                  <BookingCard key={`${entry.kind}-${entry.id}`} entry={entry} />
                ))}
                {index === groups.length - 1 ? (
                  <BookAnother
                    date={group.entries[group.entries.length - 1]?.eventDate ?? today}
                    city={city}
                  />
                ) : null}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/** Frame `19`. Never a blank pane — it says what will land here, and how. */
export function EmptyBookings(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[18px] border border-dashed border-stone-400 bg-stone-0 px-10 py-14">
      {/*
        The shared glyph, not a second copy of it. This pane hand-rolled its own
        and left the outer ring `border-[1.5px] border-stone-400` with no
        `border-dashed`, so two visually different glyphs shipped for one idea —
        `40-states.md` names it as "two circles, `stone-400`, **one dashed**".
      */}
      <span className="mb-5 block">
        <EmptyStateGlyph />
      </span>
      {/*
        An `h2`, as `EmptyState` draws it. A `p` styled to look like a headline
        leaves this state with no heading in the accessibility tree, so a
        screen-reader user landing here has nothing to navigate to.
      */}
      <h2 className="mb-2.25 font-display text-[26px] text-stone-900">No bookings yet</h2>
      <p className="mb-5 max-w-100 text-center text-base leading-[1.65] text-stone-700">
        Every request you send will land here, grouped by month, with its status and the
        vendor&rsquo;s replies.
      </p>
      <Button asChild variant="primary">
        <Link href="/search">Find a vendor</Link>
      </Button>
      <ol className="mt-6.5 flex gap-6.5">
        {['Send a request', 'Get a quote', "Pay when you're ready"].map((step, index) => (
          <li key={step} className="text-center">
            <span className="font-mono text-label font-medium tracking-[.1em] text-stone-600">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="mt-1 block text-sm font-medium text-stone-700">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
