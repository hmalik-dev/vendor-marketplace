import { AVAILABILITY_MONTHS_AHEAD } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { availabilityWindow } from './availability.service.js';

/**
 * The read window's two edges, pinned on the days they actually move.
 *
 * A server cannot know a visitor's day, and since #409 the calendar is drawn
 * from the visitor's: west of UTC they are a day behind this process, east of
 * UTC a day ahead. So both edges carry a day of slack — and on 29 days out of
 * 30 that slack changes nothing, which is exactly why nothing caught it. Every
 * case here is a **month boundary**, the only place the widening is visible.
 */
describe('availabilityWindow', () => {
  /*
   * The near edge. At 00:30 UTC on 1 October a vendor in Chicago is still in
   * 30 September, and anchoring the window on October's first put the day they
   * were standing in outside the read: their own today rendered with no status
   * at all, from a calendar whose whole job is to carry one.
   */
  it('starts in the previous month when the viewer west of UTC is still in it', () => {
    const { from } = availabilityWindow(new Date('2026-10-01T00:30:00.000Z'));

    expect(from).toBe('2026-09-01');
  });

  it('starts in the current month on every other day', () => {
    expect(availabilityWindow(new Date('2026-10-02T00:30:00.000Z')).from).toBe('2026-10-01');
    expect(availabilityWindow(new Date('2026-10-15T12:00:00.000Z')).from).toBe('2026-10-01');
    expect(availabilityWindow(new Date('2026-10-31T23:30:00.000Z')).from).toBe('2026-10-01');
  });

  /*
   * The far edge. The calendar renders `AVAILABILITY_MONTHS_AHEAD + 1` months
   * from the *viewer's* day, so at 23:30 UTC on 31 October a vendor in Tokyo is
   * already in 1 November and their last month runs past a bound counted from
   * October — every cell in it drawn as available because no row reached it.
   */
  it('reaches a day further out, so the viewer east of UTC does not run past it', () => {
    const { to } = availabilityWindow(new Date('2026-10-31T23:30:00.000Z'));

    expect(to).toBe('2027-11-01');
  });

  it('runs the stated number of months ahead', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');
    const { to } = availabilityWindow(now);

    // Tomorrow, `AVAILABILITY_MONTHS_AHEAD` months on: 2026-10-16 -> 2027-10-16.
    expect(AVAILABILITY_MONTHS_AHEAD).toBe(12);
    expect(to).toBe('2027-10-16');
  });

  it('always spans forwards, near edge before far', () => {
    for (const instant of [
      '2026-01-01T00:00:00.000Z',
      '2026-02-28T23:59:59.999Z',
      '2026-12-31T23:59:59.999Z',
    ]) {
      const { from, to } = availabilityWindow(new Date(instant));

      expect(from < to, instant).toBe(true);
    }
  });
});
