import Link from 'next/link';
import type { BookingEntry } from '@/lib/booking-entries';

/**
 * The four mechanism promises. They are what the rail carries when there is
 * nothing waiting on the customer — `40-states.md` and frame `19` are explicit
 * that **the rail is never blanked**, because an empty column beside an empty
 * pane reads as a broken page rather than a new account.
 *
 * Every line is a mechanism rather than a statistic: none of them is a number
 * we would have to invent.
 */
const MECHANISM_PROMISES = [
  { title: 'Real availability.', body: 'Calendars come from the vendor, not a guess.' },
  { title: 'Payment is held.', body: 'Your money reaches the vendor after the event.' },
  { title: 'No service fee.', body: "The price you're quoted is the price you pay." },
  { title: 'Reviews from real bookings.', body: 'Only events that happened here.' },
] as const;

export interface BookingsRailProps {
  /** Entries the customer has to act on — quotes to review, mostly. */
  needsYou: readonly BookingEntry[];
}

/**
 * The 340px rail of frames `07` and `19`.
 *
 * "Needs you" is clay because clay means *you can act here* — it is the one
 * tone reserved for the reader's own move. When nothing is waiting, the rail
 * explains how booking works instead of standing empty.
 */
export function BookingsRail({ needsYou }: BookingsRailProps): React.ReactElement {
  return (
    <aside
      aria-label="What needs your attention"
      className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-0 p-5 xl:block"
    >
      {needsYou.length > 0 ? (
        <>
          <h2 className="mb-2.75 text-xs font-semibold tracking-[.05em] text-stone-600 uppercase">
            Needs you
          </h2>
          <ul className="mb-5">
            {needsYou.map((entry) => (
              <li key={entry.id} className="mb-2.5 rounded-xl bg-clay-100 p-3.25">
                <div className="flex items-start gap-2.25">
                  <span
                    aria-hidden="true"
                    className="mt-1.25 size-1.75 shrink-0 rounded-full bg-clay-400"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-stone-900">
                      {entry.vendorName} sent a quote
                    </p>
                    <p className="mt-0.75 text-sm leading-normal text-stone-700">{entry.subline}</p>
                    {entry.vendorSlug ? (
                      <Link
                        href={`/vendors/${entry.vendorSlug}`}
                        className="mt-2.5 inline-block rounded-md bg-clay-400 px-3.25 py-1.75 text-sm font-semibold text-stone-0 hover:bg-clay-500"
                      >
                        Review quote
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="mb-3 text-xs font-semibold tracking-[.05em] text-stone-600 uppercase">
        How booking works here
      </h2>
      <div className="flex flex-col gap-3.5 text-base leading-prose text-stone-700">
        {MECHANISM_PROMISES.map((promise, index) => (
          <div key={promise.title}>
            {index > 0 ? <span className="mb-3.5 block h-px bg-stone-200" /> : null}
            <p>
              <strong className="font-semibold text-stone-900">{promise.title}</strong>{' '}
              {promise.body}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
