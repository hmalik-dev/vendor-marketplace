import {
  EVENT_TYPE_LABELS,
  formatPrice,
  type BookingRequestStatus,
  type BookingStatus,
  type EventType,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import type { WireBooking, WireBookingRequest, WireCustomerReview } from '@/lib/wire-schemas';

/**
 * Requests still in play. Everything else has finished happening, one way or
 * another, and belongs under Past — including `accepted`, which stays active
 * because it is waiting on payment rather than settled.
 */
const ACTIVE_REQUEST_STATUSES: readonly BookingRequestStatus[] = ['pending', 'quoted', 'accepted'];

/** Colour follows meaning, per `40-states.md`: gold waits, sage settles, red failed. */
const REQUEST_TONES: Record<BookingRequestStatus, StatusTone> = {
  pending: 'pending',
  // The vendor sent a number and it is the customer's move — `quoted` is its
  // own tone precisely so this reads differently from waiting.
  quoted: 'quoted',
  accepted: 'confirmed',
  declined: 'inert',
  cancelled: 'inert',
  expired: 'inert',
};

const REQUEST_LABELS: Record<BookingRequestStatus, string> = {
  pending: 'Waiting on the vendor',
  quoted: 'Quote to review',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Withdrawn',
  expired: 'Expired',
};

const BOOKING_TONES: Record<BookingStatus, StatusTone> = {
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'inert',
  disputed: 'failed',
};

const BOOKING_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

/** `2026-11-14` → `November 14, 2026`, without a timezone shifting the day. */
function formatEventDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function occasionOf(eventType: string | null): string | null {
  if (!eventType) {
    return null;
  }

  return EVENT_TYPE_LABELS[eventType as EventType] ?? eventType;
}

interface HistoryRowProps {
  href: string;
  title: string;
  subline: string;
  meta: string;
  tone: StatusTone;
  status: string;
}

function HistoryRow({ href, title, subline, meta, tone, status }: HistoryRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-4 rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5 transition-colors hover:bg-stone-100"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[19px] text-stone-900">{title}</p>
          <p className="mt-0.5 truncate text-sm text-stone-600">{subline}</p>
        </div>
        <span className="shrink-0 text-base font-semibold text-stone-900">{meta}</span>
        <StatusPill tone={tone}>{status}</StatusPill>
      </Link>
    </li>
  );
}

export interface CustomerHistoryProps {
  requests: readonly WireBookingRequest[];
  bookings: readonly WireBooking[];
  /** `active` is what is still in play; `past` is everything settled. */
  scope: 'active' | 'past';
}

/**
 * A customer's own booking history.
 *
 * Requests and bookings are shown in one list rather than two, because a
 * customer does not think of them as different objects — a request that was
 * paid for is the same event, further along.
 */
export function CustomerHistory({
  requests,
  bookings,
  scope,
}: CustomerHistoryProps): React.ReactElement {
  const paidRequestIds = new Set(bookings.map((booking) => booking.requestId));

  const visibleRequests = requests
    // A request that became a booking is rendered as the booking, not twice.
    .filter((request) => !paidRequestIds.has(request.id))
    .filter((request) =>
      scope === 'active'
        ? ACTIVE_REQUEST_STATUSES.includes(request.status)
        : !ACTIVE_REQUEST_STATUSES.includes(request.status),
    );

  const visibleBookings = bookings.filter((booking) =>
    scope === 'active' ? booking.status === 'confirmed' : booking.status !== 'confirmed',
  );

  if (visibleRequests.length === 0 && visibleBookings.length === 0) {
    return (
      <EmptyState
        headline={scope === 'active' ? 'Nothing in flight' : 'Nothing here yet'}
        description={
          scope === 'active'
            ? 'Requests you send appear here while you wait on a vendor.'
            : 'Events that have finished, and requests that did not work out, collect here.'
        }
        action={
          scope === 'active' ? (
            <Button asChild variant="primary">
              <Link href="/search">Browse vendors</Link>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visibleBookings.map((booking) => (
        <HistoryRow
          key={booking.id}
          href="/bookings"
          title={formatEventDate(booking.eventDate)}
          subline={
            [occasionOf(booking.eventType), booking.venue].filter(Boolean).join(' · ') || 'Booked'
          }
          meta={`${formatPrice(booking.totalAmountCents)} paid`}
          tone={BOOKING_TONES[booking.status]}
          status={BOOKING_LABELS[booking.status]}
        />
      ))}
      {visibleRequests.map((request) => (
        <HistoryRow
          key={request.id}
          href={`/vendors/${request.vendor.slug}`}
          title={request.vendor.businessName}
          subline={[occasionOf(request.eventType), formatEventDate(request.eventDate)]
            .filter(Boolean)
            .join(' · ')}
          meta={
            request.finalPriceCents === null ? 'To be quoted' : formatPrice(request.finalPriceCents)
          }
          tone={REQUEST_TONES[request.status]}
          status={REQUEST_LABELS[request.status]}
        />
      ))}
    </ul>
  );
}

export interface CustomerReviewsProps {
  reviews: readonly WireCustomerReview[];
}

/** What vendors said about working with this customer. */
export function CustomerReviews({ reviews }: CustomerReviewsProps): React.ReactElement {
  if (reviews.length === 0) {
    return (
      <EmptyState
        headline="No reviews yet"
        description="Reviews from vendors will appear here after completed events."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-[19px] text-stone-900">{review.vendorBusinessName}</p>
            <span className="shrink-0 text-sm text-stone-700">
              <span aria-hidden="true">★ </span>
              <span className="font-semibold">{review.rating}</span>
              <span className="sr-only"> out of 5</span>
            </span>
          </div>
          {review.title ? (
            <p className="mt-1 text-base font-semibold text-stone-900">{review.title}</p>
          ) : null}
          <p className="mt-1 text-base leading-[1.6] text-stone-700">{review.content}</p>
        </li>
      ))}
    </ul>
  );
}
