import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { SettlementNote } from '@/components/bookings/settlement-note';
import { customerDisplayName, factsLine } from '@/components/vendor/booking-card';
import { BOOKING_PRESENTATION } from '@/lib/booking-entries';
import { cancellationNarrative } from '@/lib/settlement-copy';
import type { WireBookingRequest } from '@/lib/wire-schemas';

export interface CancelledBookingCardProps {
  /** A cancelled request that reached a booking — see `lostBookings`. */
  request: WireBookingRequest;
}

/**
 * A date the vendor held and then lost (#415).
 *
 * Deliberately **not** `BookingCard` with a different pill. That card is the
 * working surface — it prints the customer's contact details and carries
 * `Mark complete` — and neither belongs on a booking that will not happen:
 * completing it is not an action that exists, and the contact block is a
 * privacy line the API draws at acceptance and this row is past.
 *
 * What it owes the vendor is what happened and what it did to their money,
 * which is the same pair the customer's own screen states, from the same
 * module, in the vendor's person.
 */
export function CancelledBookingCard({ request }: CancelledBookingCardProps): React.ReactElement {
  const displayName = customerDisplayName(request.customer);
  const { what, money } = cancellationNarrative(request.settlement, 'vendor');

  return (
    <li className="rounded-[14px] bg-stone-0 px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={displayName} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.25">
            <span className="text-md font-semibold text-stone-900">{displayName}</span>
            {/*
              The word and the tone the rest of the product already gives a
              cancelled booking, read from the one map rather than chosen again
              here — a console that painted this red where the customer saw it
              grey would be two products describing one row.
            */}
            <StatusPill tone={BOOKING_PRESENTATION.cancelled.tone}>
              {BOOKING_PRESENTATION.cancelled.label}
            </StatusPill>
          </div>

          <p className="mt-0.75 text-sm text-stone-700">{factsLine(request)}</p>
          <p className="mt-1.5 text-sm leading-[1.6] text-stone-700">{what}</p>
          <div className="mt-1.5">
            <SettlementNote money={money} />
          </div>
        </div>
      </div>
    </li>
  );
}
