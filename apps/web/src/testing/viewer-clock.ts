import { vi } from 'vitest';

/**
 * Put the browser's clock on a calendar day, and hand that day back.
 *
 * Every surface that shows a "today" resolves it from the *viewer's* clock
 * after mount (`useViewerToday`, #409), so a test that only passes
 * `serverToday` is asserting against whatever day the suite happens to run on.
 * Both have to move together, which is why this returns the date: it reads as
 * `serverToday={viewerOn('2026-06-15')}` at the call site.
 *
 * Noon UTC, so the day is the same one in every zone from UTC-12 to UTC+11 —
 * the suite's own `TZ` cannot turn the pinned day into its neighbour. A test
 * that wants the server and the viewer to disagree sets `TZ` and the instant
 * itself rather than calling this.
 *
 * Requires fake timers to be installed by the caller; `vi.setSystemTime` is a
 * no-op without them, and a helper that installed them would decide a
 * suite-wide policy from inside one call.
 */
export function viewerOn(date: string): string {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));

  return date;
}
