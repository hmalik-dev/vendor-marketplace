const SAME_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const OTHER_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * `Jun 18`, or `Mar 4, 2028` when the payout does not land in the year the
 * viewer is in.
 *
 * In `lib/` rather than beside either card because two components print it: the
 * rail's payout card and the earnings stat's delta line, which frame `08`
 * writes as `Next payout Jun 18`. The alternative was one card importing the
 * other's module for a constant.
 *
 * **The year is not decoration.** `MAX_EVENT_DATE_MONTHS_AHEAD` is 24, so a
 * booking taken today can release in 2028, and `Next payout Mar 4` on a
 * September page reads as a date six months *behind* rather than eighteen
 * ahead. The frames only ever draw a near date, so this is off-frame in exactly
 * the case the frames do not cover.
 *
 * **UTC, not the viewer's zone.** `payoutReleaseAt` lands on the release day's
 * midnight UTC, so formatting locally would move it a day backwards for
 * everyone west of Greenwich — a payout date shown a day early on the one
 * surface where a vendor would notice. #409 is the precedent, and it is also
 * why the year to compare against is the server's `YYYY-MM-DD` rather than a
 * `new Date()` read in the browser.
 */
export function formatPayoutDate(releaseAt: Date, today: string): string {
  const viewerYear = today.slice(0, 4);
  const format = String(releaseAt.getUTCFullYear()) === viewerYear ? SAME_YEAR : OTHER_YEAR;

  return format.format(releaseAt);
}
