import { describe, expect, it } from 'vitest';
import { readableDate } from './readable-date.js';

describe('readableDate', () => {
  it('names a calendar date the way a reader writes it', () => {
    expect(readableDate('2026-10-20')).toBe('October 20');
    expect(readableDate('2027-01-05')).toBe('January 5');
  });

  it('reads the stored day itself at both ends of a month and a year', () => {
    expect(readableDate('2026-12-31')).toBe('December 31');
    expect(readableDate('2026-03-01')).toBe('March 1');
  });
});
