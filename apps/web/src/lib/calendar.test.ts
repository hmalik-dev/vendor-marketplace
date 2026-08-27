import { describe, expect, it } from 'vitest';
import { buildMonth, datesBetween, monthsFrom, WEEKDAY_LABELS } from './calendar';

describe('monthsFrom', () => {
  it('starts with the month the date falls in', () => {
    expect(monthsFrom('2026-03-17', 2)).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
  });

  it('rolls into the next year', () => {
    expect(monthsFrom('2026-11-01', 3)).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2027, month: 0 },
    ]);
  });

  it('returns nothing for a malformed date', () => {
    expect(monthsFrom('not-a-date', 3)).toEqual([]);
  });

  it('returns nothing for a non-positive count', () => {
    expect(monthsFrom('2026-03-17', 0)).toEqual([]);
  });
});

describe('buildMonth', () => {
  it('labels the month and year', () => {
    expect(buildMonth(2026, 2).label).toBe('March 2026');
  });

  it('pads the leading gap so the first day lands on its weekday', () => {
    // 1 March 2026 is a Sunday, so there is no leading pad.
    expect(buildMonth(2026, 2).weeks[0]).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
    ]);

    // 1 April 2026 is a Wednesday: three leading blanks.
    expect(buildMonth(2026, 3).weeks[0]?.slice(0, 4)).toEqual([null, null, null, '2026-04-01']);
  });

  it('gives every row seven cells', () => {
    for (const week of buildMonth(2026, 3).weeks) {
      expect(week).toHaveLength(WEEKDAY_LABELS.length);
    }
  });

  it('includes every day of the month exactly once', () => {
    const days = buildMonth(2026, 1)
      .weeks.flat()
      .filter((date) => date !== null);

    // February 2026 is not a leap year.
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-02-01');
    expect(days.at(-1)).toBe('2026-02-28');
  });

  it('handles a leap February', () => {
    const days = buildMonth(2028, 1)
      .weeks.flat()
      .filter((date) => date !== null);

    expect(days).toHaveLength(29);
    expect(days.at(-1)).toBe('2028-02-29');
  });
});

describe('datesBetween', () => {
  it('returns an inclusive ascending range', () => {
    expect(datesBetween('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
  });

  it('accepts the ends in either order', () => {
    expect(datesBetween('2026-03-04', '2026-03-01')).toEqual(
      datesBetween('2026-03-01', '2026-03-04'),
    );
  });

  it('returns the single date when both ends match', () => {
    expect(datesBetween('2026-03-01', '2026-03-01')).toEqual(['2026-03-01']);
  });

  it('crosses a month boundary', () => {
    expect(datesBetween('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });

  it('returns nothing for a malformed end', () => {
    expect(datesBetween('2026-03-01', '2026-02-30')).toEqual([]);
  });
});
