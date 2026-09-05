'use client';

import { todayDateString } from '@vendor-marketplace/shared';
import { useEffect, useState } from 'react';

/**
 * The viewer's own calendar day, as `YYYY-MM-DD`.
 *
 * **Why this exists.** `todayDateString()` reads the caller's wall clock, and
 * its own contract says it is "only ever meaningful on the client" — yet server
 * components called it, where it returned the *Node process's* day. Rendered on
 * a host running UTC that is the UTC day, and west of UTC a vendor's current
 * evening renders as already past: the availability calendar labels the day
 * they are standing in "in the past", and east of UTC yesterday stays pickable
 * on the booking-request form. #409. #391 fixed the earnings month by the same
 * reasoning in the other direction — a label has to be derived from the same
 * clock as the thing it annotates, and for "today" that clock is the viewer's.
 *
 * **Why an effect rather than render.** A viewer's day is not knowable during
 * SSR, so `serverToday` seeds the first render and the hook re-anchors after
 * mount. Computing it during render would make the client's first tree disagree
 * with the server's HTML across a date boundary, which React reports as a
 * hydration mismatch. `search-bar.tsx` already resolves its date floor this way.
 *
 * **What it does not do.** It resolves once. A tab left open across midnight
 * keeps yesterday's anchor, which is the same bound every other date floor in
 * the product has; whether a *submitted* date is past is asked again against a
 * fresh clock at submit time, and the API's own guard is `isUniversallyPastDate`.
 *
 * @param serverToday The day rendered on the server — the UTC day — used for
 *   the first paint so hydration matches. Pass `toDateString(new Date())`. Pass
 *   `''` where the component has no server day to inherit: every date compares
 *   as not-past against it, so the first paint imposes no floor at all rather
 *   than the wrong one, and the real floor lands a tick later.
 */
export function useViewerToday(serverToday: string): string {
  const [today, setToday] = useState(serverToday);

  useEffect(() => {
    setToday(todayDateString());
  }, []);

  return today;
}
