import { NextPayout } from '@/components/vendor/next-payout';
import { WeekStrip } from '@/components/vendor/week-strip';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

export interface PublishedRailProps {
  dashboard: WireVendorDashboard;
}

/**
 * The right column once the profile is live — the booking week and the next
 * payout, per frame `27 Vendor dashboard — 1024`, the only frame in the bundle
 * that draws a *published* vendor's dashboard.
 *
 * **It sits inside the content pane, not beside it.** Frame `08`'s bordered,
 * padded outer rail is the *unpublished* composition, where the column is a
 * checklist the vendor refers back to from other pages. Frame `27` draws this
 * one as two plain cards in the pane at `width:300px; flex:none`, separated
 * from the requests column by a 16px gap and carrying no border of their own —
 * so `PublishChecklist` keeps the outer rail and this does not.
 *
 * 300px at 1024, 340px at 1440, matching the ladder the outer rail follows.
 * Below 1024 the whole dashboard stacks and this column goes with it.
 */
export function PublishedRail({ dashboard }: PublishedRailProps): React.ReactElement {
  return (
    <aside
      aria-label="Your week"
      className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto lg:flex min-[90rem]:w-[340px]"
    >
      <WeekStrip week={dashboard.bookingWeek} />
      <NextPayout payout={dashboard.nextPayout} />
    </aside>
  );
}
