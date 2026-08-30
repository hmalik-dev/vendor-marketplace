import {
  isUniversallyPastDate,
  toDateString,
  type NearbyAvailabilityQuery,
  type NearbyAvailabilityResult,
} from '@vendor-marketplace/shared';
import { validationFailed } from '../../lib/errors.js';
import type { AppDatabase } from '../../lib/database.js';
import { findVendorsFreeNearby } from './nearby-availability.dao.js';

/**
 * Who is free near a date that came back empty.
 *
 * The band is **absent rather than empty** when nobody is: frame `18`'s screen
 * stands on its own without it, and "nobody nearby either" is a worse answer
 * than not raising the question. That decision belongs to the caller, so this
 * simply returns no items and lets the screen decide.
 *
 * **`now` is the one place today is decided.** Both rules below depend on it —
 * which dates are refused outright, and where the candidate window starts —
 * and they used to read two different clocks: this function's UTC day, and
 * whatever day the database session considered current. Taking the instant as
 * an argument makes them the same day by construction, and lets a suite pin it
 * instead of passing at 14:00 and failing at 21:00.
 */
export async function findNearbyAvailability(
  db: AppDatabase,
  query: NearbyAvailabilityQuery,
  now: Date = new Date(),
): Promise<NearbyAvailabilityResult> {
  /*
   * A date already gone cannot be moved around: every candidate day in the
   * window would be in the past, and the honest answer is that the question
   * does not apply rather than an empty list that looks like scarcity.
   */
  if (isUniversallyPastDate(query.date, now)) {
    throw validationFailed('That date has already passed — pick today or a later one');
  }

  const page = await findVendorsFreeNearby(db, query, toDateString(now));

  return { items: page.items, total: page.total, windowDays: query.windowDays };
}
