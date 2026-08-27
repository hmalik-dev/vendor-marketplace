import { describe, expect, it } from 'vitest';
import {
  addDays,
  calculateFees,
  centsToDollars,
  dollarsToCents,
  formatPrice,
  generateSlug,
  isFutureDate,
  isPastDate,
  kmToMiles,
  milesToKm,
  parseDateString,
  toDateString,
  todayDateString,
} from './index.js';

describe('generateSlug', () => {
  it('lowercases and hyphenates a business name', () => {
    expect(generateSlug('Golden Hour Photography')).toBe('golden-hour-photography');
  });

  it('strips punctuation and collapses separators', () => {
    expect(generateSlug("Bella's   Bakes & Cakes!!")).toBe('bellas-bakes-cakes');
  });

  it('transliterates accented Latin characters', () => {
    expect(generateSlug('Café Crème Décor')).toBe('cafe-creme-decor');
  });

  it('falls back to a stable placeholder when nothing survives normalization', () => {
    expect(generateSlug('日本語')).toBe('vendor');
    expect(generateSlug('   ')).toBe('vendor');
    expect(generateSlug('')).toBe('vendor');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('--DJ Nova--')).toBe('dj-nova');
  });

  it('caps the slug at the column length without a trailing hyphen', () => {
    const slug = generateSlug(`${'a'.repeat(120)} ${'b'.repeat(120)}`);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('price conversion', () => {
  it('converts dollars to integer cents', () => {
    expect(dollarsToCents(25)).toBe(2500);
    expect(dollarsToCents(1234.56)).toBe(123456);
  });

  it('rounds half-cent dollar values rather than truncating', () => {
    expect(dollarsToCents(0.005)).toBe(1);
    expect(dollarsToCents(19.999)).toBe(2000);
  });

  it('converts cents back to dollars', () => {
    expect(centsToDollars(2500)).toBe(25);
    expect(centsToDollars(123456)).toBe(1234.56);
  });

  it('formats cents as USD', () => {
    expect(formatPrice(123456)).toBe('$1,234.56');
    expect(formatPrice(2501)).toBe('$25.01');
    expect(formatPrice(1)).toBe('$0.01');
  });

  /*
   * Vendor prices are almost always whole dollars, and a column of `$1,450.00`
   * spends two characters per row saying nothing. See the display-boundary
   * table in design/design-plan/01-foundations.md.
   */
  it('hides the cents when a price is a whole number of dollars', () => {
    expect(formatPrice(2500)).toBe('$25');
    expect(formatPrice(0)).toBe('$0');
    expect(formatPrice(145000)).toBe('$1,450');
    expect(formatPrice(240000)).toBe('$2,400');
  });

  it('groups thousands so a four-figure price is readable at a glance', () => {
    expect(formatPrice(100000)).toBe('$1,000');
    expect(formatPrice(999999)).toBe('$9,999.99');
  });
});

describe('calculateFees', () => {
  it('splits a total into platform fee and vendor payout at the default 12% rate', () => {
    expect(calculateFees(100_000)).toEqual({
      totalCents: 100_000,
      platformFeeCents: 12_000,
      vendorPayoutCents: 88_000,
    });
  });

  it('rounds the fee to a whole cent and keeps the split exact', () => {
    const fees = calculateFees(2501);
    expect(fees.platformFeeCents).toBe(300);
    expect(fees.platformFeeCents + fees.vendorPayoutCents).toBe(2501);
  });

  it('accepts an override rate', () => {
    expect(calculateFees(10_000, 0.2).platformFeeCents).toBe(2000);
  });

  it('rejects a non-integer or negative total', () => {
    expect(() => calculateFees(10.5)).toThrow(/integer/i);
    expect(() => calculateFees(-1)).toThrow(/negative/i);
  });

  it('rejects a rate outside [0, 1)', () => {
    expect(() => calculateFees(10_000, 1)).toThrow(/rate/i);
    expect(() => calculateFees(10_000, -0.1)).toThrow(/rate/i);
  });
});

describe('date helpers', () => {
  it('formats a Date as a calendar date string in UTC', () => {
    expect(toDateString(new Date('2026-07-04T23:30:00.000Z'))).toBe('2026-07-04');
  });

  it('parses a calendar date string to UTC midnight', () => {
    const parsed = parseDateString('2026-07-04');
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe('2026-07-04T00:00:00.000Z');
  });

  it('returns null for a malformed or impossible date string', () => {
    expect(parseDateString('2026-13-01')).toBeNull();
    expect(parseDateString('2026-02-30')).toBeNull();
    expect(parseDateString('07/04/2026')).toBeNull();
    expect(parseDateString('')).toBeNull();
  });

  it('adds days without mutating the input', () => {
    const start = new Date('2026-02-27T00:00:00.000Z');
    expect(toDateString(addDays(start, 2))).toBe('2026-03-01');
    expect(start.toISOString()).toBe('2026-02-27T00:00:00.000Z');
  });

  it('treats today as not a future date and tomorrow as one', () => {
    const now = new Date('2026-07-04T12:00:00.000Z');
    expect(isFutureDate('2026-07-04', now)).toBe(false);
    expect(isFutureDate('2026-07-05', now)).toBe(true);
    expect(isFutureDate('2026-07-03', now)).toBe(false);
  });

  it('treats an unparseable date as not in the future', () => {
    expect(isFutureDate('nope', new Date('2026-07-04T12:00:00.000Z'))).toBe(false);
  });
});

describe('kmToMiles and milesToKm', () => {
  it('converts a service radius to miles for display', () => {
    expect(kmToMiles(80)).toBe(50);
    expect(kmToMiles(1.609344)).toBe(1);
    expect(kmToMiles(50)).toBe(31);
  });

  it('converts a chosen mile radius back to stored kilometres', () => {
    expect(milesToKm(50)).toBe(80);
    expect(milesToKm(1)).toBe(2);
    expect(milesToKm(30)).toBe(48);
  });

  it('keeps a round-trip within a mile of where it started', () => {
    for (const miles of [5, 10, 25, 50, 75, 100, 125]) {
      expect(kmToMiles(milesToKm(miles))).toBe(miles);
    }
  });

  it('handles a zero radius without producing NaN', () => {
    expect(kmToMiles(0)).toBe(0);
    expect(milesToKm(0)).toBe(0);
  });
});

describe('todayDateString', () => {
  /*
   * Local, not UTC. A customer at 22:00 in UTC+13 is on a day the UTC clock has
   * not reached; reading their "today" off UTC would grey out the date they are
   * standing in. The fixture is built from local parts for that reason.
   */
  it('reads the day off the local clock, not the UTC one', () => {
    const localNoon = new Date(2026, 5, 14, 12, 0, 0);

    expect(todayDateString(localNoon)).toBe('2026-06-14');
  });

  it('pads a single-digit month and day', () => {
    expect(todayDateString(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
  });

  it('stays on the local day at either end of it', () => {
    expect(todayDateString(new Date(2026, 5, 14, 0, 0, 0))).toBe('2026-06-14');
    expect(todayDateString(new Date(2026, 5, 14, 23, 59, 59))).toBe('2026-06-14');
  });
});

describe('isPastDate', () => {
  const TODAY = '2026-06-14';

  it('calls an earlier calendar date past', () => {
    expect(isPastDate('2026-06-13', TODAY)).toBe(true);
    expect(isPastDate('2025-12-31', TODAY)).toBe(true);
  });

  /* An event happening today is still bookable, so today is not past. */
  it('does not call today past', () => {
    expect(isPastDate(TODAY, TODAY)).toBe(false);
  });

  it('does not call a later date past', () => {
    expect(isPastDate('2026-06-15', TODAY)).toBe(false);
    expect(isPastDate('2027-01-01', TODAY)).toBe(false);
  });

  /*
   * Malformed input is invalid, not past — a different answer that earns a
   * different message. `2026-02-30` would roll forward into March if it were
   * parsed, so it must not be treated as a real date at all.
   */
  it('treats a malformed or impossible date as not past', () => {
    for (const value of ['', 'yesterday', '14-06-2026', '2026-02-30', '2026-13-01']) {
      expect(isPastDate(value, TODAY), value).toBe(false);
    }
  });

  it('compares across year and month boundaries', () => {
    expect(isPastDate('2026-05-31', '2026-06-01')).toBe(true);
    expect(isPastDate('2026-06-01', '2026-05-31')).toBe(false);
  });
});
