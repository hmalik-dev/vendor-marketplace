import {
  EVENT_TYPE_LABELS,
  expiryCountdown,
  formatPrice,
  type BookingStatus,
  type EventType,
  type PayoutStatus,
} from '@vendor-marketplace/shared';
import type { StatusTone } from '@/components/ui/status-pill';
import type { WireBookingRequest, WireOwnBooking } from './wire-schemas';

/**
 * One row of the bookings hub.
 *
 * A customer does not think of a request and a booking as different objects —
 * a request that was paid for is the same event, further along — so the hub
 * flattens both tables into one list. The distinction still matters to the
 * actions available, which is what `kind` carries.
 */
export interface BookingEntry {
  id: string;
  kind: 'request' | 'booking';
  /**
   * The request this row's detail page lives under — `/bookings/<requestId>`.
   *
   * Both kinds have one. A booking's detail route is its *request's*, because
   * that page renders the whole negotiation and its outcome, so a paid booking
   * is reachable rather than a dead card (#400).
   */
  requestId: string;
  vendorSlug: string | null;
  vendorName: string;
  vendorImageUrl: string | null;
  categoryName: string | null;
  /** The occasion, written out — "Wedding", not `wedding`. */
  occasion: string | null;
  /** `YYYY-MM-DD`; every sort and grouping key is derived from this. */
  eventDate: string;
  venue: string | null;
  status: string;
  statusLabel: string;
  statusTone: StatusTone;
  /** "$1,450 paid · Barr Mansion" — amount, state, then where. */
  subline: string;
  /** Settled one way or the other, so it belongs under History. */
  isSettled: boolean;
  /**
   * The last day the customer may review this booking, or `null` when they
   * cannot (VEN-747). Only a booking row can carry one.
   */
  reviewDeadline: string | null;
}

/**
 * How a request's status is named and toned wherever it is shown.
 *
 * Exported because the request detail screen shows the same statuses and must
 * use the same words — a cancelled request is "Withdrawn" here and a cancelled
 * *booking* is "Cancelled", and a second table of labels is how those two come
 * to disagree.
 */
export const REQUEST_PRESENTATION: Record<
  string,
  { label: string; tone: StatusTone; settled: boolean }
> = {
  pending: { label: 'Pending', tone: 'pending', settled: false },
  quoted: { label: 'Quoted', tone: 'quoted', settled: false },
  accepted: { label: 'Accepted', tone: 'needsYou', settled: false },
  declined: { label: 'Declined', tone: 'inert', settled: true },
  cancelled: { label: 'Withdrawn', tone: 'inert', settled: true },
  expired: { label: 'Expired', tone: 'inert', settled: true },
};

/**
 * How a booking status is worded and toned, everywhere it is shown.
 *
 * Exported for the same reason the request map beside it is: the customer hub,
 * the request detail screen and the admin console all render these statuses,
 * and a second table of labels is how those come to disagree — the console
 * briefly drew `cancelled` red where the customer saw it grey, and `disputed`
 * clay where the customer saw it red.
 *
 * `settled` is only meaningful to the hub's grouping; the console reads the
 * label and the tone and ignores it.
 */
export const BOOKING_PRESENTATION: Record<
  BookingStatus,
  { label: string; tone: StatusTone; settled: boolean }
> = {
  confirmed: { label: 'Confirmed', tone: 'confirmed', settled: false },
  completed: { label: 'Completed', tone: 'completed', settled: true },
  cancelled: { label: 'Cancelled', tone: 'inert', settled: true },
  disputed: { label: 'Disputed', tone: 'failed', settled: true },
};

/**
 * How a payout state is worded and toned on the console (#432).
 *
 * Here rather than in `payment-table.tsx` for a reason that is not tidiness:
 * that module is `'use client'`, and **every export of a client module is
 * replaced by a client reference on the server**. The Payments *page* is a
 * Server Component and needs the failing label for its filter option, so
 * importing it from there hands the page a proxy rather than a string. It
 * survives today only because the value is passed straight into another client
 * component, which resolves it back — and breaks the moment anyone renders it
 * on the server, such as folding it into the empty-state copy on the same page.
 *
 * `held` earns `needsYou` rather than `failed`: a dispute hold is deliberate
 * and correct, and painting it as a failure would tell an admin to fix
 * something that is working.
 */
export const PAYOUT_PRESENTATION: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Awaiting release', tone: 'pending' },
  held: { label: 'Held', tone: 'needsYou' },
  released: { label: 'Released', tone: 'confirmed' },
  'not-owed': { label: 'Not owed', tone: 'inert' },
};

/**
 * The failing flag's words, in one place so the filter option on the page and
 * the pill on the row cannot drift — the same reason the Bookings screen keeps
 * `REFUND_STUCK_LABEL` beside both of its uses.
 *
 * Not a member of `PAYOUT_PRESENTATION`: `isPayoutFailing` is a flag *beside*
 * the three shared states rather than a fourth one, and giving it a slot in
 * that map would make it look like a `PayoutStatus` the API can return.
 */
export const PAYOUT_FAILING_LABEL = 'Transfer failing';

/**
 * Owed to a banned or closed vendor, so the sweep will never send it (VEN-445).
 * Drawn *instead of* `Awaiting release`, which promises a release that is not
 * coming; a flag beside `PAYOUT_PRESENTATION` for the same reason as the above.
 */
export const PAYOUT_STRANDED_LABEL = 'Stranded — vendor banned or closed';

function occasionOf(eventType: string | null): string | null {
  if (!eventType) {
    return null;
  }

  return EVENT_TYPE_LABELS[eventType as EventType] ?? eventType;
}

/** Whole days from `today` to `date`; negative once the date has passed. */
export function daysUntil(date: string, today: string): number {
  const [ty, tm, td] = today.split('-').map(Number);
  const [ey, em, ed] = date.split('-').map(Number);

  if (!ty || !tm || !td || !ey || !em || !ed) {
    return 0;
  }

  // Built from the parts rather than parsed, so no timezone shifts the day.
  const from = Date.UTC(ty, tm - 1, td);
  const to = Date.UTC(ey, em - 1, ed);

  return Math.round((to - from) / 86_400_000);
}

/*
 * The countdown moved to `expiryCountdown` in the shared package. There were
 * two implementations of it under the same name — this one and the vendor
 * queue's — and they rendered the same deadline differently, so a customer and
 * a vendor comparing notes saw two answers.
 */

export function requestToEntry(request: WireBookingRequest, now: Date = new Date()): BookingEntry {
  const presentation = REQUEST_PRESENTATION[request.status] ?? {
    label: request.status,
    tone: 'inert' as StatusTone,
    settled: true,
  };

  /*
   * The sub-line says the one thing that matters at this status, which is not
   * the same thing at each — frame `07` writes a pending card "awaiting reply
   * · 2d" and a paid one "$1,450 paid · Barr Mansion". Leading a pending
   * request with its price would state a number nobody has agreed to yet.
   */
  const expiry = expiryCountdown(request.expiresAt, now);
  const subline =
    request.status === 'pending'
      ? ['awaiting reply', expiry].filter(Boolean).join(' · ')
      : request.status === 'quoted'
        ? [
            request.quotedPriceCents === null
              ? 'quoted'
              : `${formatPrice(request.quotedPriceCents)} quoted`,
            expiry,
          ]
            .filter(Boolean)
            .join(' · ')
        : [
            request.finalPriceCents === null
              ? 'no price agreed'
              : formatPrice(request.finalPriceCents),
            request.eventLocation,
          ]
            .filter(Boolean)
            .join(' · ');

  return {
    id: request.id,
    kind: 'request',
    requestId: request.id,
    vendorSlug: request.vendor.slug,
    vendorName: request.vendor.businessName,
    vendorImageUrl: request.vendor.avatarUrl,
    categoryName: request.vendor.categoryName,
    occasion: occasionOf(request.eventType),
    eventDate: request.eventDate,
    venue: request.eventLocation,
    status: request.status,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    subline,
    isSettled: presentation.settled,
    reviewDeadline: null,
  };
}

export function bookingToEntry(
  booking: WireOwnBooking,
  vendorName: string,
  categoryName: string | null = null,
  vendorSlug: string | null = null,
): BookingEntry {
  const presentation = BOOKING_PRESENTATION[booking.status];

  return {
    id: booking.id,
    kind: 'booking',
    requestId: booking.requestId,
    vendorSlug,
    vendorName,
    vendorImageUrl: null,
    categoryName,
    occasion: occasionOf(booking.eventType),
    eventDate: booking.eventDate,
    venue: booking.venue,
    status: booking.status,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    subline: [`${formatPrice(booking.totalAmountCents)} paid`, booking.venue]
      .filter(Boolean)
      .join(' · '),
    isSettled: presentation.settled,
    reviewDeadline: booking.reviewDeadline,
  };
}

/**
 * Both tables as one list, newest event first, with a request that became a
 * booking rendered once — as the booking, which is the further-along truth.
 */
export function toEntries(
  requests: readonly WireBookingRequest[],
  bookings: readonly WireOwnBooking[],
  now: Date = new Date(),
): BookingEntry[] {
  const nameByVendorId = new Map(
    requests.map((request) => [request.vendorId, request.vendor.businessName]),
  );
  /*
   * The booking read model carries no category, and it does not need to: every
   * booking was a request first, and the request list still holds that row even
   * once it has been paid — `paidRequestIds` only removes it from the *rendered*
   * list, below. So the category rides across on the vendor it shares, rather
   * than being denormalised onto a second table.
   */
  const categoryByVendorId = new Map(
    requests.map((request) => [request.vendorId, request.vendor.categoryName]),
  );
  // The same ride across for the slug, which the `Leave a review` link needs (VEN-747).
  const slugByVendorId = new Map(
    requests.map((request) => [request.vendorId, request.vendor.slug]),
  );
  const paidRequestIds = new Set(bookings.map((booking) => booking.requestId));

  return [
    ...bookings.map((booking) =>
      bookingToEntry(
        booking,
        nameByVendorId.get(booking.vendorId) ?? 'Your vendor',
        categoryByVendorId.get(booking.vendorId) ?? null,
        slugByVendorId.get(booking.vendorId) ?? null,
      ),
    ),
    ...requests
      .filter((request) => !paidRequestIds.has(request.id))
      .map((request) => requestToEntry(request, now)),
  ].sort((left, right) => left.eventDate.localeCompare(right.eventDate));
}

/**
 * One thing waiting on the customer, as the rail's `Needs you` panel draws it:
 * a quote to review or decline, an accepted request to pay for, or a finished
 * booking to review.
 */
export interface NeedsYouItem {
  kind: 'quote' | 'pay' | 'review';
  entry: BookingEntry;
  /** "Casa Verde sent a quote" — the rail and the list-column mirror share it. */
  title: string;
  /** The lines under the title, one fact each. */
  detail: readonly string[];
  /** The panel's primary action; `Decline` rides beside a quote's. */
  action: { label: string; href: string };
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * "Your wedding was 6 days ago." — frame `07`'s gold panel. `other`'s label,
 * "Something else", names no occasion, so it reads as the event.
 */
function eventAgo(entry: BookingEntry, today: string): string {
  const days = -daysUntil(entry.eventDate, today);
  let when: string;
  if (days <= 0) {
    when = 'today';
  } else if (days === 1) {
    when = 'yesterday';
  } else {
    when = `${days} days ago`;
  }
  const occasion =
    entry.occasion && entry.occasion !== EVENT_TYPE_LABELS.other
      ? entry.occasion.toLowerCase()
      : 'event';

  return `Your ${occasion} was ${when}.`;
}

/**
 * "Reviews close Oct 8." The API keeps a window open until its last day is past
 * everywhere, so on the UTC day after it the date would already read as gone;
 * from the last day on, the line says today.
 */
function reviewsClose(deadline: string, today: string): string {
  return daysUntil(deadline, today) <= 0
    ? 'Reviews close today.'
    : `Reviews close ${SHORT_DATE.format(new Date(`${deadline}T00:00:00Z`))}.`;
}

/**
 * Everything in `entries` that waits on the customer: quotes first, then the
 * accepted requests awaiting payment, then the finished bookings still open to
 * review, newest event first — frame `07` and `20-customer-bookings-hub.md`'s
 * "Accepted → Pay now" and "Completed → Leave a review".
 *
 * Quote and pay items come from request rows only. A paid request is already a
 * booking row in `toEntries`, so it can never surface here as a second
 * `Pay now`. A review needs the vendor's slug to link to, so a closed vendor's
 * booking asks for none.
 */
export function needsYouItems(entries: readonly BookingEntry[], today: string): NeedsYouItem[] {
  const requests = entries.filter((entry) => entry.kind === 'request');

  return [
    ...requests
      .filter((entry) => entry.status === 'quoted')
      .map((entry) => ({
        kind: 'quote' as const,
        entry,
        title: `${entry.vendorName} sent a quote`,
        detail: [entry.subline],
        action: { label: 'Review quote', href: `/bookings/${entry.requestId}` },
      })),
    ...requests
      .filter((entry) => entry.status === 'accepted')
      .map((entry) => ({
        kind: 'pay' as const,
        entry,
        title: `${entry.vendorName} accepted your request`,
        detail: [entry.subline],
        action: { label: 'Pay now', href: `/bookings/${entry.requestId}/checkout` },
      })),
    ...entries
      .filter(
        (entry): entry is BookingEntry & { reviewDeadline: string; vendorSlug: string } =>
          entry.kind === 'booking' && entry.reviewDeadline !== null && entry.vendorSlug !== null,
      )
      .sort((left, right) => right.eventDate.localeCompare(left.eventDate))
      .map((entry) => ({
        kind: 'review' as const,
        entry,
        title: `Leave a review for ${entry.vendorName}`,
        detail: [eventAgo(entry, today), reviewsClose(entry.reviewDeadline, today)],
        action: { label: 'Write a review', href: `/vendors/${entry.vendorSlug}?tab=reviews` },
      })),
  ];
}

export type BookingTab = 'upcoming' | 'history' | 'all';

/**
 * Upcoming is anything whose date is still ahead **and** which has not been
 * settled — a declined request for a future date is history, not a plan.
 */
export function entriesForTab(
  entries: readonly BookingEntry[],
  tab: BookingTab,
  today: string,
): BookingEntry[] {
  if (tab === 'all') {
    return [...entries];
  }

  const upcoming = entries.filter(
    (entry) => !entry.isSettled && daysUntil(entry.eventDate, today) >= 0,
  );

  return tab === 'upcoming' ? upcoming : entries.filter((entry) => !upcoming.includes(entry));
}

export interface MonthGroup {
  /** `JUNE 2026` — the uppercase micro-label the frame draws. */
  label: string;
  /** `YYYY-MM`, so groups sort without parsing the label back. */
  key: string;
  entries: BookingEntry[];
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Groups by the month of the booking date and nothing else.
 *
 * **This is the whole of the grouping model.** There is no Event entity, no
 * `event_id`, and no way to create one — the month is derived from the date
 * every booking already has, and the header is presentational.
 */
export function groupByMonth(entries: readonly BookingEntry[]): MonthGroup[] {
  const groups = new Map<string, BookingEntry[]>();

  for (const entry of entries) {
    const key = entry.eventDate.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  /*
   * Insertion order, not a second sort. A `Map` preserves the order keys were
   * first written, so the months come out in the order the entries arrived —
   * oldest first for the ascending list this is normally given, and newest first
   * once `Latest first` reverses it. Re-sorting here instead would leave the
   * months climbing while the cards inside them descended.
   */
  return [...groups.entries()].map(([key, grouped]) => ({
    key,
    label: MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`)).toUpperCase(),
    entries: grouped,
  }));
}

const CARD_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "Sun, Jun 14" — the weekday is what makes a date legible at a glance. */
export function formatCardDate(date: string): string {
  return CARD_DATE.format(new Date(`${date}T00:00:00Z`));
}

const EVENT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * "October 20, 2026" — the long form the request form and its review step use.
 *
 * The request detail screen printed `request.eventDate` straight into its
 * summary line, so the one page a customer lands on from the hub read
 * `Wedding · 2026-10-20 · Barr Mansion` while every other rendering of that
 * same date was written out. UTC because an event date is a `DATE` column and
 * must not be re-read in the viewer's zone — the same anchoring `formatCardDate`
 * and `MONTH_LABEL` above use.
 *
 * **This is the only implementation.** The request form, its review step and
 * the customer's own history each carried a private copy, two of them under
 * this exact name, agreeing on the output by coincidence of construction
 * rather than by contract (#412).
 */
export function formatEventDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);

  // A value that is not a date is handed back as it came, never as
  // `Invalid Date` — the callers that want their own word for "no date yet"
  // say so at the call site.
  return Number.isNaN(parsed.getTime()) ? date : EVENT_DATE.format(parsed);
}

/**
 * "4 upcoming bookings. Next up is Kessler & Co. in 49 days." — derived from
 * the nearest future booking, or `null` when there is none to name.
 */
export function summarise(
  entries: readonly BookingEntry[],
  today: string,
): { count: number; nextVendor: string; inDays: number } | null {
  const upcoming = entriesForTab(entries, 'upcoming', today);
  const next = upcoming[0];

  if (!next) {
    return null;
  }

  return {
    count: upcoming.length,
    nextVendor: next.vendorName,
    inDays: daysUntil(next.eventDate, today),
  };
}

/**
 * How the hub's `Soonest first ▾` chip orders the list.
 *
 * The event date and nothing else — not created-at, not price. The hub is a
 * calendar of commitments, and "soonest" means the next thing the customer has
 * to turn up to.
 */
export type BookingSort = 'soonest' | 'latest';

export const BOOKING_SORTS: readonly BookingSort[] = ['soonest', 'latest'];

export interface BookingRefinements {
  /** A category name as it is drawn, or `null` for "All categories". */
  category: string | null;
  sort: BookingSort;
}

/**
 * The categories actually present in this customer's bookings, for the chip's
 * option list.
 *
 * Derived from the rows rather than from the category table: offering "Florals"
 * to someone who has never booked a florist is a filter whose only possible
 * effect is to empty the list. Entries with no category are omitted rather than
 * becoming a blank option.
 */
export function categoryNamesOf(entries: readonly BookingEntry[]): string[] {
  const names = new Set<string>();

  for (const entry of entries) {
    if (entry.categoryName) {
      names.add(entry.categoryName);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

/**
 * Applies the two Refine chips — the category filter and the date sort.
 *
 * A `category` no entry carries is **dropped rather than applied**. It arrives
 * from a stale link or a hand-typed URL, and matching nothing would render an
 * empty hub that gives the customer no way to tell a filter with no results from
 * a hub with no bookings at all.
 *
 * Returns a new array: the caller's list is a server-rendered prop, and sorting
 * it in place would reorder the same array the tab counts were taken from.
 */
export function applyRefinements(
  entries: readonly BookingEntry[],
  { category, sort }: BookingRefinements,
): BookingEntry[] {
  const known = category !== null && entries.some((entry) => entry.categoryName === category);
  const filtered = known
    ? entries.filter((entry) => entry.categoryName === category)
    : [...entries];

  return filtered.sort((left, right) =>
    sort === 'soonest'
      ? left.eventDate.localeCompare(right.eventDate)
      : right.eventDate.localeCompare(left.eventDate),
  );
}
