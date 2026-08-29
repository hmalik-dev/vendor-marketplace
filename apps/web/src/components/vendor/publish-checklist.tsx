import {
  PUBLISH_BLOCKERS,
  PUBLISH_BLOCKER_KEYS,
  type PublishBlockerKey,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

const SCHEDULE_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface PublishChecklistProps {
  dashboard: WireVendorDashboard;
  today: string;
}

/**
 * The rail. While the profile is unpublished it is the checklist; once it is
 * live it becomes today's schedule.
 *
 * **The rows are the real publish gate**, read from the same `publishBlockers`
 * the gate itself computes — not a parallel list. A checklist that disagrees
 * with the gate is worse than no checklist, because it tells a vendor they are
 * ready and then the gate refuses them.
 */
export function PublishChecklist({ dashboard, today }: PublishChecklistProps): React.ReactElement {
  const blocking = new Set<PublishBlockerKey>(dashboard.publishBlockers);
  const done = PUBLISH_BLOCKER_KEYS.length - blocking.size;
  const firstOpen = PUBLISH_BLOCKER_KEYS.find((key) => blocking.has(key));

  if (dashboard.isPublished) {
    return (
      <aside
        aria-label="Today"
        className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-0 p-5 xl:box-content xl:block"
      >
        <h2 className="mb-2.5 text-label font-semibold tracking-label text-stone-600 uppercase">
          {SCHEDULE_DATE.format(new Date(`${today}T00:00:00Z`))}
        </h2>
        {dashboard.todaysBookings.length === 0 ? (
          <p className="text-base leading-prose text-stone-700">
            Nothing booked today. Your calendar is what customers search against, so keeping it
            current is what brings the next one in.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {dashboard.todaysBookings.map((booking) => (
              <li key={booking.id} className="rounded-xl bg-stone-150 px-3.5 py-2.5">
                <p className="text-base font-semibold text-stone-900">
                  {booking.customerFirstName}
                </p>
                {booking.eventLocation ? (
                  <p className="mt-0.5 text-sm text-stone-700">{booking.eventLocation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Publish checklist"
      className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-0 p-5 xl:box-content xl:block"
    >
      <div className="mb-2.75 flex items-baseline justify-between">
        <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">
          Publish checklist
        </h2>
        <span className="text-xs text-stone-600">
          {done} of {PUBLISH_BLOCKER_KEYS.length}
        </span>
      </div>

      <div className="mb-3.5 h-1.25 rounded-full bg-stone-200">
        <div
          className="h-1.25 rounded-full bg-clay-400"
          style={{ width: `${(done / PUBLISH_BLOCKER_KEYS.length) * 100}%` }}
        />
      </div>

      <ul className="mb-5 flex flex-col">
        {PUBLISH_BLOCKER_KEYS.map((key) => {
          const isBlocking = blocking.has(key);
          const isNext = key === firstOpen;

          return (
            <li
              key={key}
              className="flex items-center gap-2.5 border-b border-stone-200 py-2.25 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4.25 shrink-0 items-center justify-center rounded-full',
                  isBlocking
                    ? isNext
                      ? 'border-[1.5px] border-gold-400'
                      : 'border-[1.5px] border-stone-400'
                    : 'bg-sage-400 text-stone-0',
                )}
              >
                {isBlocking ? null : <Check className="size-2.5" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  'text-base',
                  isNext ? 'font-semibold text-stone-900' : 'text-stone-700',
                  isBlocking && !isNext ? 'text-stone-600' : null,
                )}
              >
                {PUBLISH_BLOCKERS[key].message}
              </span>
              {isNext ? (
                <Link
                  href={PROFILE_EDIT_PATH}
                  className="ml-auto shrink-0 text-sm font-semibold text-clay-500 hover:underline"
                >
                  Finish →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/*
        Gold, because this is waiting on the vendor — never red. Nothing has
        failed; the profile simply is not finished, and the panel says what
        that costs rather than that something is wrong.
      */}
      <p className="rounded-xl bg-gold-50 px-3.25 py-3.25 text-sm leading-[1.55] text-gold-600">
        Customers cannot find you until your profile is published. Nothing on this list takes more
        than a few minutes.
      </p>
    </aside>
  );
}
