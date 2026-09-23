import { CURRENT_REFUND_TERMS, refundBoundaries } from '@vendor-marketplace/shared';

/**
 * What cancelling will return, stated before payment, as a clause that reads
 * after "—" or "and" (VEN-615).
 *
 * Today's terms, because nothing has been sold yet. The deadline is an instant
 * in the viewer's zone, never "48 hours before the event": the zero point is
 * midnight UTC on the event date, so an hour count misstates it by the offset.
 * And it is measured against `now`, because an accepted request can be for a
 * date whose full-refund window, or whose online cancellation, has already
 * closed — a deadline nobody can meet is not a promise to print beside a pay
 * button. `null` for a date the parser rejects.
 */
export function prePaymentRefundClause(
  eventDate: string,
  format: (instant: Date) => string,
  now: Date = new Date(),
): string | null {
  const boundaries = refundBoundaries(eventDate, CURRENT_REFUND_TERMS);

  if (boundaries === null) {
    return null;
  }

  const fullEnds = new Date(boundaries.fullRefundEndsAt);
  const closes = new Date(boundaries.onlineCancellationClosesAt);

  if (now.getTime() <= fullEnds.getTime()) {
    return `you're refunded in full if you cancel by ${format(fullEnds)}`;
  }

  if (now.getTime() < closes.getTime()) {
    return `the full-refund window ended ${format(fullEnds)}, so cancelling before ${format(closes)} refunds part of the total`;
  }

  return `online cancellation closed ${format(closes)}, so once paid it can't be cancelled here`;
}
