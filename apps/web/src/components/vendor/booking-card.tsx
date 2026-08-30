import { EVENT_TYPE_LABELS, formatPrice, type EventType } from '@vendor-marketplace/shared';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { CompleteBooking } from '@/components/vendor/complete-booking';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

const CARD_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * One booking the vendor has committed to.
 *
 * The card answers the two questions an accepted request left unanswerable:
 * what am I booked for, and who am I booked with. The contact block only has
 * values to render past acceptance — the API sends `null` before that — so the
 * privacy rule is enforced at the source and this component just renders what
 * it is given rather than deciding a second time.
 */
export interface BookingCardProps {
  request: WireBookingRequest;
  /**
   * The paid booking behind this request, when there is one.
   *
   * An accepted request and a paid booking are different things and the card
   * has to say which it is: a vendor who has accepted but not been paid must
   * not be told the date is settled, and only a paid booking can be completed.
   */
  booking: WireBooking | null;
  /** Today as `YYYY-MM-DD`, resolved once on the server for the whole list. */
  today: string;
}

export function BookingCard({ request, booking, today }: BookingCardProps): React.ReactElement {
  const { customer } = request;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || customer.firstName || 'A customer';

  return (
    <li className="rounded-[14px] bg-stone-0 px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={displayName} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.25">
            <span className="text-md font-semibold text-stone-900">{displayName}</span>
            {/*
              Accepted is not paid. `40-states.md` reserves sage for settled, so
              an unpaid booking reads gold — it is still waiting on someone.
            */}
            {booking ? (
              <StatusPill tone="confirmed">Booked</StatusPill>
            ) : (
              <StatusPill tone="pending">Awaiting payment</StatusPill>
            )}
          </div>

          <p className="mt-0.75 text-sm text-stone-700">{factsLine(request)}</p>

          {/*
            The reason this surface exists. A vendor who has committed to a date
            needs a way to reach the customer that does not depend on them
            opening the app, so the details are plain text and selectable rather
            than hidden behind a hover.
          */}
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-700">
            {customer.email ? (
              <div className="flex gap-1.5">
                <dt className="text-stone-600">Email</dt>
                <dd>
                  <a className="text-clay-500 hover:underline" href={`mailto:${customer.email}`}>
                    {customer.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {customer.phone ? (
              <div className="flex gap-1.5">
                <dt className="text-stone-600">Phone</dt>
                <dd>
                  <a className="text-clay-500 hover:underline" href={`tel:${customer.phone}`}>
                    {customer.phone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="font-display text-[20px] text-stone-900">
            {request.finalPriceCents === null ? '—' : formatPrice(request.finalPriceCents)}
          </p>
          {booking ? <CompleteBooking booking={booking} today={today} /> : null}
        </div>
      </div>
    </li>
  );
}

/** "Wedding · Saturday, June 14, 2027 · Barr Mansion · 120 guests · Full day coverage" */
function factsLine(request: WireBookingRequest): string {
  return [
    request.eventType
      ? (EVENT_TYPE_LABELS[request.eventType as EventType] ?? request.eventType)
      : null,
    CARD_DATE.format(new Date(`${request.eventDate}T00:00:00Z`)),
    request.eventLocation,
    request.guestCount === null ? null : `${request.guestCount} guests`,
    request.package ? request.package.name : 'Custom request',
  ]
    .filter(Boolean)
    .join(' · ');
}
