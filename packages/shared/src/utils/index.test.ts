import { describe, expect, it } from 'vitest';
import {
  addDays,
  calculateFees,
  centsToDollars,
  dollarsToCents,
  formatPrice,
  generateSlug,
  isFutureDate,
  parseDateString,
  toDateString,
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
    expect(formatPrice(2500)).toBe('$25.00');
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(123456)).toBe('$1,234.56');
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
