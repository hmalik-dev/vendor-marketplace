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

/**
 * The unpublished dashboard's right column, at the two widths the frames draw it.
 *
 * **It used to be `hidden … xl:block`, so it did not exist below 1280** — and
 * frames `08 Vendor dashboard` and `27 Vendor dashboard — 1024` both draw a
 * right column. `30-responsive.md` is explicit that "a rail that wraps under the
 * content is a bug" at 1024 and that this column is 300px there, so hiding it
 * was the one degradation the ladder forbids.
 *
 * 300px at 1024, 340px at 1440 (frame `08`), `box-content` so the 20px padding
 * and the 1px border sit outside the number the frame draws. Still stacked below
 * 1024: the vendor nav is a horizontal scroller there, not a sidebar, and no
 * frame draws a three-column dashboard narrower than a small laptop.
 */
const RAIL_CLASS =
  'hidden w-[300px] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-0 p-5 lg:box-content lg:block min-[90rem]:w-[340px]';

export interface PublishChecklistProps {
  dashboard: WireVendorDashboard;
}

/**
 * The rail while the profile is unpublished — frame `08`'s bordered outer rail.
 *
 * **The rows are the real publish gate**, read from the same `publishBlockers`
 * the gate itself computes — not a parallel list. A checklist that disagrees
 * with the gate is worse than no checklist, because it tells a vendor they are
 * ready and then the gate refuses them.
 *
 * Once the profile is live the column becomes `PublishedRail` — the booking week
 * and the next payout, in the pane rather than beside it. This used to render
 * today's schedule there instead; frame `27 Vendor dashboard — 1024` is the only
 * frame that draws a published vendor's dashboard and it draws the week, so
 * `16-vendor-dashboard.md` was corrected rather than the frame ignored.
 */
export function PublishChecklist({ dashboard }: PublishChecklistProps): React.ReactElement {
  const blocking = new Set<PublishBlockerKey>(dashboard.publishBlockers);
  const done = PUBLISH_BLOCKER_KEYS.length - blocking.size;
  const firstOpen = PUBLISH_BLOCKER_KEYS.find((key) => blocking.has(key));

  return (
    <aside aria-label="Publish checklist" className={RAIL_CLASS}>
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
