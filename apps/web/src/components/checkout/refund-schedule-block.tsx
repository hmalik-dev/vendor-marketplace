import {
  formatPrice,
  LEGAL_PATHS,
  refundSchedule,
  type RefundScheduleRow,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Clock } from 'lucide-react';

/**
 * Frame `33` — the refund schedule, **shown** above the pay control rather than
 * linked in the footer.
 *
 * A customer committing two thousand dollars to a date eleven months out is
 * entitled to know what happens if the date moves, at the moment they commit.
 * So the rows are resolved into this booking's own dates and amounts: not "30
 * days before the event", not "50%", but the day and the dollars. A customer
 * should not have to do date arithmetic to find out whether they can still get
 * their money back.
 *
 * **The tiers are the code's, not the design's.** The frame draws
 * `30 days / 50% / non-refundable`, and its own prompt says the schedule is a
 * guess. The product enforces `FULL_REFUND_CUTOFF_HOURS` and
 * `LATE_CANCELLATION_REFUND_RATE`, and it has **no non-refundable tier at
 * all** — so what is drawn here is what `calculateRefund` will actually pay,
 * because a policy that promises something the code does not do is the one
 * failure that creates a dispute the platform loses (#374).
 */

/** The day a boundary falls on, in the event's own zone — UTC, like the dates. */
const BOUNDARY_DAY = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const EVENT_DAY = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface RefundScheduleBlockProps {
  /** The booking total, in cents — what a full refund returns. */
  totalCents: number;
  /** `YYYY-MM-DD`, the stored calendar date. */
  eventDate: string;
  /** Used in the copy, so the rows read as this vendor's terms. */
  vendorName: string;
  /**
   * Show only the row that applies at `now`, plus the vendor-cancels row.
   *
   * The customer hub wants the current position rather than a schedule; before
   * paying, the whole schedule is the point. Off by default because the screen
   * this was built for is checkout.
   */
  onlyCurrent?: boolean;
  /** Injected so a test can pin the day rather than race the real clock. */
  now?: Date;
}

/** What each row's label and consequence say, given this booking's numbers. */
function describe(
  row: RefundScheduleRow,
  next: RefundScheduleRow | undefined,
  vendorName: string,
  eventDate: Date,
): { label: string; consequence: React.ReactNode } {
  if (row.kind === 'full') {
    return {
      label: `Before ${BOUNDARY_DAY.format(next?.from ?? eventDate)}`,
      consequence: (
        <>
          Cancel for a <strong className="font-semibold">full refund</strong> —{' '}
          {formatPrice(row.refundCents ?? 0)} back
        </>
      ),
    };
  }

  if (row.kind === 'late') {
    return {
      label: `From ${BOUNDARY_DAY.format(row.from ?? eventDate)}`,
      consequence: <>{formatPrice(row.refundCents ?? 0)} back — the rest holds the date</>,
    };
  }

  if (row.kind === 'release') {
    return {
      label: `After ${BOUNDARY_DAY.format(eventDate)}`,
      consequence: (
        <>
          The event has happened. Your payment is released to {vendorName} on{' '}
          {BOUNDARY_DAY.format(row.from ?? eventDate)}.
        </>
      ),
    };
  }

  return {
    label: `If ${vendorName} cancels`,
    consequence: (
      <>
        <strong className="font-semibold">Full refund</strong>, whenever it happens
      </>
    ),
  };
}

/** The row that governs `now` — the one a customer looking at a live booking can act on. */
export function currentRow(
  rows: readonly RefundScheduleRow[],
  now: Date,
): RefundScheduleRow | null {
  const windowed = rows.filter((row) => row.kind !== 'vendor-cancels');

  return (
    [...windowed]
      .reverse()
      .find((row) => row.from === null || row.from.getTime() <= now.getTime()) ?? null
  );
}

export function RefundScheduleBlock({
  totalCents,
  eventDate,
  vendorName,
  onlyCurrent = false,
  now = new Date(),
}: RefundScheduleBlockProps): React.ReactElement | null {
  const rows = refundSchedule(totalCents, eventDate);

  if (rows === null) {
    /*
     * An unparseable date reaches here only if a stored `DATE` stopped being
     * one. Rendering nothing is right: an empty rail beats a block of
     * `Invalid Date`, and the pay button above it still works.
     */
    return null;
  }

  const event = new Date(`${eventDate}T00:00:00Z`);
  const shown = onlyCurrent
    ? [currentRow(rows, now), rows.find((row) => row.kind === 'vendor-cancels')].filter(
        (row): row is RefundScheduleRow => row !== null && row !== undefined,
      )
    : rows;

  return (
    <section
      aria-labelledby="refund-schedule"
      className="rounded-[14px] border border-stone-300 bg-stone-150 px-4.25 py-4"
    >
      <h2
        id="refund-schedule"
        className="mb-1.5 flex items-center gap-1.75 text-label font-semibold tracking-label text-stone-600 uppercase"
      >
        <Clock aria-hidden="true" className="size-3.5" />
        If plans change
      </h2>

      <dl>
        {shown.map((row, index) => {
          /*
           * The successor is taken from the **full** schedule, not from what is
           * being shown: the full-refund row's label is the day the next window
           * opens, and in `onlyCurrent` mode its neighbour has been filtered out
           * of `shown`. Reading the neighbour from `shown` there would label the
           * window with the vendor-cancels row's date, which has none.
           */
          const next = rows[rows.indexOf(row) + 1];
          const { label, consequence } = describe(row, next, vendorName, event);

          return (
            <div
              key={row.kind}
              className={`flex gap-3 py-2.25 ${
                index === shown.length - 1 ? '' : 'border-b border-stone-300'
              }`}
            >
              <dt
                className={`w-28 flex-none text-meta font-semibold ${
                  row.kind === 'vendor-cancels' ? 'text-sage-600' : 'text-stone-900'
                }`}
              >
                {label}
              </dt>
              <dd className="text-meta leading-prose text-stone-700">{consequence}</dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-helper text-stone-600">
        <span>Dates calculated from {EVENT_DAY.format(event)}.</span>
        <Link
          href={`${LEGAL_PATHS.terms}#cancellations-and-refunds`}
          className="font-semibold text-clay-500 underline-offset-4 hover:underline"
        >
          Full policy
        </Link>
      </p>
    </section>
  );
}
