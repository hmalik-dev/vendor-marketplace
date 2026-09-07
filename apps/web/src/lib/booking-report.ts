import {
  isUniversallyFutureDate,
  payoutStatusOf,
  type BookingStatus,
} from '@vendor-marketplace/shared';

/**
 * Whether a customer can still report a problem with one of their bookings,
 * and what to tell them when they cannot (#425).
 *
 * **Both bounds are the server's own, and neither is restated here.** A report
 * exists to place #423's payout hold, so it can only do something between the
 * event happening and the money leaving — and `placeDisputeHold` refuses on
 * exactly those two facts:
 *
 * - the lower bound is `isUniversallyFutureDate`, the same predicate, not the
 *   viewer's own day. #409's lesson was that a client guard and a server guard
 *   drawn from different clocks disagree about the same booking;
 * - the upper bound is **`payoutReleasedAt`, the column**, read through
 *   `payoutStatusOf` — the one derivation #423 wrote for this, so no surface
 *   infers "the money is stuck" from the status enum.
 *
 * `payoutReleaseAt(eventDate)` is deliberately *not* the upper bound, though it
 * is the obvious one to reach for. It says when the sweep **may** move the
 * money; it does not say that it has. Between that instant and the sweep
 * actually running, a control gated on the prediction is withdrawn from a
 * customer whose hold the API would still accept — and the screen tells them
 * the vendor has been paid when nobody has been. The prediction is the right
 * thing to *say* (`ReportProblem` names the date the window closes with it) and
 * the wrong thing to decide on.
 */
export type ReportWindow =
  /** Open. The one state that offers the control. */
  | 'open'
  /** Already reported — acceptance 5 says so rather than offering a second. */
  | 'reported'
  /** The event is still ahead everywhere on Earth. */
  | 'before-event'
  /** The payout has been transferred; only a human can unwind it now. */
  | 'released'
  /** Cancelled: there is no booking left to report. */
  | 'closed';

/** The three columns the window is decided from, and nothing else. */
export interface ReportSubject {
  status: BookingStatus;
  eventDate: string;
  payoutReleasedAt: Date | null;
}

export function reportWindowFor(booking: ReportSubject, now: Date = new Date()): ReportWindow {
  /*
   * Cancelled first, and before the payout question: a cancelled booking whose
   * payout had already gone out is still "there is nothing here to report",
   * and answering `released` would offer a customer a support route about a
   * booking they themselves called off.
   */
  if (booking.status === 'cancelled') {
    return 'closed';
  }

  const payout = payoutStatusOf(booking);

  if (payout === 'held') {
    return 'reported';
  }

  if (payout === 'released') {
    return 'released';
  }

  return isUniversallyFutureDate(booking.eventDate, now) ? 'before-event' : 'open';
}

/**
 * The booking, as `/support` renders it in its attached block and as the send
 * names it.
 *
 * Every field is read from the row on the server. The URL carries the id alone,
 * which is what keeps this block a statement about a booking rather than an
 * echo of whatever the visitor put in their query string.
 */
export interface SupportBookingContext {
  id: string;
  eventDate: string;
  totalAmountCents: number;
  venue: string | null;
}
