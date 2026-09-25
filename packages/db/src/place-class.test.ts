import { describe, expect, it } from 'vitest';

import { stripPlaceClass } from './place-class.js';

describe('stripPlaceClass', () => {
  it.each([
    ['Athens-Clarke County unified government (balance)', 'Athens-Clarke County'],
    ['Sitka city and borough', 'Sitka'],
    ['Juneau city and borough', 'Juneau'],
    ['Abbeville city', 'Abbeville'],
    ['Abanda CDP', 'Abanda'],
    ['Urban Honolulu CDP', 'Urban Honolulu'],
    ['Nashville-Davidson metropolitan government (balance)', 'Nashville-Davidson'],
    ['Bear Creek charter township', 'Bear Creek'],
    ['Ponce zona urbana', 'Ponce'],
    ['Boston', 'Boston'],
  ])('turns %j into %j', (raw, expected) => {
    expect(stripPlaceClass(raw)).toBe(expected);
  });

  it.each([
    ['Sitka city and borough balance', 'Sitka'],
    ['Sitka and borough', 'Sitka'],
    ['Sitka borough city', 'Sitka'],
    ['Sitka city city and borough', 'Sitka'],
    ['Bear Creek township balance', 'Bear Creek'],
    ['Sitka city and borough of Alaska', 'Sitka city and borough of Alaska'],
  ])('strips stacked classes only from the end: %j', (raw, expected) => {
    expect(stripPlaceClass(raw)).toBe(expected);
  });

  it('does not backtrack exponentially on a run of classes that almost matches', () => {
    // The previous pattern parsed each `city and borough` two ways: 2^40 here.
    const hostile = `X${' city and borough'.repeat(40)}!`;
    const started = performance.now();

    expect(stripPlaceClass(hostile)).toBe(hostile);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
