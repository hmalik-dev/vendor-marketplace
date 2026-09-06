import { PUBLISH_BLOCKERS, type PublishBlockerKey } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

export interface PublishBlockerBannerProps {
  /** Straight from `publishBlockers` on the dashboard payload — the real gate. */
  blockers: readonly PublishBlockerKey[];
  /**
   * Whether the storefront is live. **Published-with-blockers is reachable**, so
   * this is not derivable from `blockers` being empty: `updateVendorProfile`
   * re-runs the gate only on a request that sets `isPublished`, and `bio` has no
   * minimum length, so a live vendor who clears their bio keeps `isPublished`
   * and gains a blocker. Read the flag rather than inferring it, or the banner
   * tells a vendor who *is* in search that they are not.
   */
  isPublished: boolean;
}

/**
 * The gold banner at the top of an unpublished dashboard — frames `20` and
 * `27 Vendor dashboard — empty · 1024`, which the app had no counterpart for.
 *
 * **It names the blockers the gate is actually holding**, not a parallel setup
 * list. D30 ruled that setup completeness and publishing are one list of six:
 * portfolio, availability and a starting price never gated publishing, and
 * `payouts` is not a `PUBLISH_BLOCKERS` key (#360) — it keeps its own banner one
 * element below, where frame `08` puts it. So the sentence here is built from
 * the same `publishBlockers` the checklist rail renders and the API computes,
 * and the two can never disagree.
 *
 * Gold, not red: `40-states.md` reserves red for a failure. Nothing has failed —
 * the profile simply is not finished.
 *
 * Two recorded deviations. Frame `20` closes the sentence with "Customers can't
 * find you until both are done", which is true only at exactly two blockers and
 * repeats the gold panel in the checklist rail one column over; the 1024 frame
 * this ticket owns draws the blocker list alone, and that is what ships. And the
 * count is a **numeral** where the frames write "two", because it is data and
 * because the editor's save bar one screen over already writes `1 thing left
 * before you can publish` — two spellings of one count on two surfaces is worse
 * than either. The frame's closing full stop is not a deviation and is kept.
 */
export function PublishBlockerBanner({
  blockers,
  isPublished,
}: PublishBlockerBannerProps): React.ReactElement | null {
  if (isPublished || blockers.length === 0) {
    return null;
  }

  return (
    <Banner
      status="pending"
      className="mb-4"
      title={
        <>
          Your profile isn&rsquo;t live yet &mdash; {blockers.length} thing
          {blockers.length === 1 ? '' : 's'} left
        </>
      }
      action={
        <Button asChild size="sm">
          <Link href={PROFILE_EDIT_PATH}>Finish profile</Link>
        </Button>
      }
    >
      {`${blockers.map((key) => PUBLISH_BLOCKERS[key].message).join(' · ')}.`}
    </Banner>
  );
}
