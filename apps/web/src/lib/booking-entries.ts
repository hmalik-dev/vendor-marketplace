import { EVENT_TYPE_LABELS, formatPrice, type EventType } from '@vendor-marketplace/shared';
import type { StatusTone } from '@/components/ui/status-pill';
import type { WireBooking, WireBookingRequest } from './wire-schemas';

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
}

const REQUEST_PRESENTATION: Record<string, { label: string; tone: StatusTone; settled: boolean }> =
  {
    pending: { label: 'Pending', tone: 'pending', settled: false },
    quoted: { label: 'Quoted', tone: 'quoted', settled: false },
    accepted: { label: 'Accepted', tone: 'needsYou', settled: false },
    declined: { label: 'Declined', tone: 'inert', settled: true },
    cancelled: { label: 'Withdrawn', tone: 'inert', settled: true },
    expired: { label: 'Expired', tone: 'inert', settled: true },
  };

const BOOKING_PRESENTATION: Record<string, { label: string; tone: StatusTone; settled: boolean }> =
  {
    confirmed: { label: 'Confirmed', tone: 'confirmed', settled: false },
    completed: { label: 'Completed', tone: 'completed', settled: true },
    cancelled: { label: 'Cancelled', tone: 'inert', settled: true },
    disputed: { label: 'Disputed', tone: 'failed', settled: true },
  };

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

/** "expires in 3d", or "expires today" on the last day. */
function expiryPhrase(expiresAt: Date | null, now: Date): string | null {
  if (!expiresAt) {
    return null;
  }

  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);

  if (days <= 0) {
    return 'expired';
  }

  return days === 1 ? 'expires today' : `expires in ${days}d`;
}

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
  const expiry = expiryPhrase(request.expiresAt, now);
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
    vendorSlug: request.vendor.slug,
    vendorName: request.vendor.businessName,
    vendorImageUrl: request.vendor.avatarUrl,
    categoryName: null,
    occasion: occasionOf(request.eventType),
    eventDate: request.eventDate,
    venue: request.eventLocation,
    status: request.status,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    subline,
    isSettled: presentation.settled,
  };
}

export function bookingToEntry(booking: WireBooking, vendorName: string): BookingEntry {
  const presentation = BOOKING_PRESENTATION[booking.status] ?? {
    label: booking.status,
    tone: 'inert' as StatusTone,
    settled: true,
  };

  return {
    id: booking.id,
    kind: 'booking',
    vendorSlug: null,
    vendorName,
    vendorImageUrl: null,
    categoryName: null,
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
  };
}

/**
 * Both tables as one list, newest event first, with a request that became a
 * booking rendered once — as the booking, which is the further-along truth.
 */
export function toEntries(
  requests: readonly WireBookingRequest[],
  bookings: readonly WireBooking[],
  now: Date = new Date(),
): BookingEntry[] {
  const nameByVendorId = new Map(
    requests.map((request) => [request.vendorId, request.vendor.businessName]),
  );
  const paidRequestIds = new Set(bookings.map((booking) => booking.requestId));

  return [
    ...bookings.map((booking) =>
      bookingToEntry(booking, nameByVendorId.get(booking.vendorId) ?? 'Your vendor'),
    ),
    ...requests
      .filter((request) => !paidRequestIds.has(request.id))
      .map((request) => requestToEntry(request, now)),
  ].sort((left, right) => left.eventDate.localeCompare(right.eventDate));
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

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, grouped]) => ({
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
