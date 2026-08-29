import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import {
  entriesForTab,
  formatCardDate,
  groupByMonth,
  summarise,
  type BookingEntry,
  type BookingTab,
} from '@/lib/booking-entries';
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
          <span aria-hidden="true" className="size-9.5 rounded-[9px] bg-stone-150" />
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
      <p className="truncate text-xs text-stone-600">{entry.subline}</p>
    </>
  );

  const className =
    'block rounded-[14px] bg-stone-0 p-3.5 shadow-sm transition-shadow hover:shadow-hover';

  return (
    <li>
      {entry.vendorSlug ? (
        <Link href={`/vendors/${entry.vendorSlug}`} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
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
        <span className="text-base font-semibold text-stone-900">Book another vendor</span>
        <span className="text-xs text-stone-600">
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
}: BookingsHubProps): React.ReactElement {
  const visible = entriesForTab(entries, tab, today);
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
              {entry.vendorSlug ? (
                <Link
                  href={`/vendors/${entry.vendorSlug}`}
                  className="ml-auto text-sm font-semibold text-clay-500 hover:underline"
                >
                  Review quote
                </Link>
              ) : null}
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
                  href={`/bookings?tab=${name}`}
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
        {/*
          Drawn as the frame draws them, and inert until there is more than one
          month or category to choose between — #31's rule is that a control
          which opens nothing is furniture.
        */}
        <div className="flex gap-2 pb-1.25">
          <span className="rounded-md border border-stone-300 bg-stone-0 px-3 py-1.5 text-sm font-semibold text-stone-900">
            All categories ▾
          </span>
          <span className="rounded-md border border-stone-300 bg-stone-0 px-3 py-1.5 text-sm font-semibold text-stone-900">
            Soonest first ▾
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-5">
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
                <span className="text-xs text-stone-600">
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
      {/* The mark's two rings, at rest. */}
      <span aria-hidden="true" className="relative mb-5 block h-9 w-14.5">
        <span className="absolute top-0 left-0 size-9 rounded-full bg-stone-150" />
        <span className="absolute top-0 left-5.5 size-9 rounded-full border-[1.5px] border-stone-400" />
      </span>
      <p className="mb-2.25 font-display text-[26px] text-stone-900">No bookings yet</p>
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
