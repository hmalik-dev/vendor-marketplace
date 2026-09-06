import { addDays } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { isNewVendor, NEW_VENDOR_WINDOW_DAYS } from './vendor-recency.js';

const NOW = new Date('2026-09-06T12:00:00.000Z');

/** `days` before `NOW`, to the millisecond. */
const daysAgo = (days: number): Date => addDays(NOW, -days);

describe('isNewVendor', () => {
  it('calls a profile created today new', () => {
    expect(isNewVendor(NOW, NOW)).toBe(true);
  });

  it('calls a profile created inside the window new', () => {
    expect(isNewVendor(daysAgo(NEW_VENDOR_WINDOW_DAYS - 1), NOW)).toBe(true);
  });

  /*
   * The boundary, both sides. A window that included its own far edge would
   * make a vendor new for 31 days and the constant a lie about itself.
   */
  it('stops exactly at the window, rather than a day either side of it', () => {
    expect(isNewVendor(daysAgo(NEW_VENDOR_WINDOW_DAYS), NOW)).toBe(false);
    expect(isNewVendor(new Date(daysAgo(NEW_VENDOR_WINDOW_DAYS).getTime() + 1), NOW)).toBe(true);
  });

  /*
   * The ruling this exists for: `New` means genuinely new, not review-less.
   * Nothing here reads a review count — an old profile is old whatever its
   * reviews say, and that is the whole substance of #417 item 3.
   */
  it('calls an old profile old, however long ago it was created', () => {
    expect(isNewVendor(daysAgo(365), NOW)).toBe(false);
  });

  /*
   * A clock skew between the app and the database can put a row a moment in
   * the future. That is new, not an error, and must not read as 31 days old.
   */
  it('treats a profile timestamped just ahead of the clock as new', () => {
    expect(isNewVendor(new Date(NOW.getTime() + 1000), NOW)).toBe(true);
  });
});
