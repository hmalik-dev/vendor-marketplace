import { describe, expect, it } from 'vitest';
import { FULL_REFUND_CUTOFF_HOURS } from '../constants/index.js';
import {
  addDays,
  calculateFees,
  calculateRefund,
  centsToDollars,
  dollarsToCents,
  formatPrice,
  generateSlug,
  isFutureDate,
  isPastDate,
  isUniversallyFutureDate,
  isUniversallyPastDate,
  kmToMiles,
  milesToKm,
  parseDateString,
  replyDeadline,
  shortTimeAgo,
  toDateString,
  todayDateString,
  universallyPastFrom,
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

/*
 * D3's tiers, in cents. The boundary is the whole point of the function, so it
 * is asserted from both sides of it rather than only in the middle of each
 * band — 48 hours exactly is a full refund, one minute later is half.
 */
describe('calculateRefund', () => {
  const EVENT = '2026-06-14';
  const TOTAL = 145_000;

  it('returns everything at exactly the cutoff', () => {
    const quote = calculateRefund(TOTAL, EVENT, new Date('2026-06-12T00:00:00Z'));

    expect(quote.refundCents).toBe(145_000);
    expect(quote.isFullRefund).toBe(true);
    expect(quote.hoursUntilEvent).toBe(FULL_REFUND_CUTOFF_HOURS);
  });

  it('returns half one minute inside the cutoff', () => {
    const quote = calculateRefund(TOTAL, EVENT, new Date('2026-06-12T00:01:00Z'));

    expect(quote.refundCents).toBe(72_500);
    expect(quote.isFullRefund).toBe(false);
  });

  it('returns half once the event day has already begun', () => {
    expect(calculateRefund(TOTAL, EVENT, new Date('2026-06-20T00:00:00Z'))).toEqual({
      refundCents: 72_500,
      isFullRefund: false,
      hoursUntilEvent: 0,
    });
  });

  /* An odd total must not lose or invent a cent between the two halves. */
  it('rounds a half refund to a whole cent', () => {
    const quote = calculateRefund(2_501, EVENT, new Date('2026-06-13T12:00:00Z'));

    expect(quote.refundCents).toBe(1_251);
    expect(TOTAL % 2).toBe(0);
  });

  /*
   * The event day starts at midnight **UTC**, not in the reader's zone. A
   * `DATE` column carries no time, so anything else would refund a customer in
   * Auckland and a customer in Honolulu differently for the same cancellation
   * on the same booking.
   */
  it('measures from midnight UTC on the event date', () => {
    expect(
      calculateRefund(TOTAL, EVENT, new Date('2026-06-11T23:59:00Z')).hoursUntilEvent,
    ).toBeCloseTo(48.02, 1);
  });

  it('rejects a total that is not whole cents, and a date that is not a date', () => {
    expect(() => calculateRefund(10.5, EVENT)).toThrow(/integer/i);
    expect(() => calculateRefund(-1, EVENT)).toThrow(/integer/i);
    expect(() => calculateRefund(TOTAL, 'not-a-date')).toThrow(/calendar date/i);
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

describe('universallyPastFrom', () => {
  /*
   * The point of this helper is that it cannot drift from the predicate it
   * names, so the test asserts the boundary against `isUniversallyPastDate`
   * itself rather than against a second hand-computed constant.
   */
  it('returns the first instant at which the date is past everywhere', () => {
    const boundary = universallyPastFrom('2026-07-04');
    expect(boundary).not.toBeNull();

    expect(isUniversallyPastDate('2026-07-04', boundary!)).toBe(true);
    expect(isUniversallyPastDate('2026-07-04', new Date(boundary!.getTime() - 1))).toBe(false);
  });

  it('leaves the event date itself, and the day after it, still live somewhere', () => {
    const boundary = universallyPastFrom('2026-07-04')!;

    expect(isUniversallyPastDate('2026-07-04', new Date('2026-07-04T23:59:59.999Z'))).toBe(false);
    expect(isUniversallyPastDate('2026-07-04', new Date('2026-07-05T23:59:59.999Z'))).toBe(false);
    expect(boundary.toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('returns null for a malformed or impossible date string', () => {
    expect(universallyPastFrom('2026-02-30')).toBeNull();
    expect(universallyPastFrom('nope')).toBeNull();
  });
});

describe('replyDeadline', () => {
  const created = new Date('2026-07-04T09:00:00.000Z');

  it('is a week out when the event is further away than that', () => {
    expect(replyDeadline(created, '2026-12-25')?.toISOString()).toBe('2026-07-11T09:00:00.000Z');
  });

  it('is capped at the event, never outliving it', () => {
    // Seven days from creation would be 2026-07-11; the event is the 6th.
    expect(replyDeadline(created, '2026-07-06')?.toISOString()).toBe('2026-07-08T00:00:00.000Z');
  });

  it('still leaves a same-day request answerable', () => {
    const deadline = replyDeadline(created, '2026-07-04');

    expect(deadline).not.toBeNull();
    expect(deadline!.getTime()).toBeGreaterThan(created.getTime());
    expect(isUniversallyPastDate('2026-07-04', deadline!)).toBe(true);
  });

  it('falls back to the plain week when the date cannot be parsed', () => {
    expect(replyDeadline(created, 'nope')?.toISOString()).toBe('2026-07-11T09:00:00.000Z');
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

/*
 * Extracted from `messages-screen.tsx` by #302, when the bookings rail needed
 * the same string. It is tested here rather than there for the reason
 * `expiryCountdown` records above: a duration format with two implementations is
 * how two surfaces come to disagree about one row.
 */
describe('shortTimeAgo', () => {
  const NOW = new Date('2026-04-26T12:00:00Z').getTime();

  function at(offsetMinutes: number): Date {
    return new Date(NOW - offsetMinutes * 60_000);
  }

  it('counts minutes below an hour', () => {
    expect(shortTimeAgo(at(14), NOW)).toBe('14m');
    expect(shortTimeAgo(at(59), NOW)).toBe('59m');
  });

  /*
   * A message sent nine seconds ago reads as "now" to a person, and "0m" reads
   * as a bug. The floor is what makes the freshest row the one that looks it.
   */
  it('floors at a minute rather than counting seconds', () => {
    expect(shortTimeAgo(new Date(NOW - 9_000), NOW)).toBe('1m');
    expect(shortTimeAgo(new Date(NOW), NOW)).toBe('1m');
  });

  it('counts hours below a day, and days beyond it', () => {
    expect(shortTimeAgo(at(60), NOW)).toBe('1h');
    expect(shortTimeAgo(at(23 * 60), NOW)).toBe('23h');
    expect(shortTimeAgo(at(24 * 60), NOW)).toBe('1d');
    expect(shortTimeAgo(at(3 * 24 * 60), NOW)).toBe('3d');
  });

  /* A thread with no messages renders nothing, never the word "never". */
  it('is empty for a null date', () => {
    expect(shortTimeAgo(null, NOW)).toBe('');
  });
});

/**
 * The mirror of `isUniversallyPastDate`, and it earns its own suite because the
 * two are easy to write as each other's negation, which they are not: between
 * them sits a band where the date is somebody's yesterday, somebody's today and
 * somebody's tomorrow at once, and both predicates answer `false` across it.
 * That band is the point — it is the only honest answer a server has about a
 * caller whose zone it does not know (#409).
 */
describe('isUniversallyFutureDate', () => {
  const EVENT = '2026-07-04';

  it('is true only while the date is ahead in every zone', () => {
    // UTC+14 is the first zone to reach the 4th: it does so as the server's UTC
    // clock passes into the 3rd, and until then nobody anywhere is on it.
    expect(isUniversallyFutureDate(EVENT, new Date('2026-07-02T23:59:59.999Z'))).toBe(true);
    expect(isUniversallyFutureDate(EVENT, new Date('2026-07-03T00:00:00.000Z'))).toBe(false);
  });

  it('is false on the day itself and after it', () => {
    expect(isUniversallyFutureDate(EVENT, new Date('2026-07-04T12:00:00.000Z'))).toBe(false);
    expect(isUniversallyFutureDate(EVENT, new Date('2026-07-05T12:00:00.000Z'))).toBe(false);
    expect(isUniversallyFutureDate(EVENT, new Date('2027-01-01T00:00:00.000Z'))).toBe(false);
  });

  /*
   * Not each other's negation. Both are false through the band where the date
   * is live for somebody, which is exactly the window a server must refuse
   * neither reading in.
   */
  it('leaves a band where the date is neither past nor future everywhere', () => {
    for (const instant of [
      '2026-07-03T00:00:00.000Z',
      '2026-07-04T12:00:00.000Z',
      '2026-07-05T23:59:59.999Z',
    ]) {
      const now = new Date(instant);

      expect(isUniversallyFutureDate(EVENT, now), instant).toBe(false);
      expect(isUniversallyPastDate(EVENT, now), instant).toBe(false);
    }
  });

  it('is false for a malformed date, which is invalid rather than future', () => {
    expect(isUniversallyFutureDate('2026-02-30')).toBe(false);
    expect(isUniversallyFutureDate('nope')).toBe(false);
  });
});
