import { describe, expect, it } from 'vitest';

import { stripPlaceClass } from './place-class.js';

/** The pattern as it stood before the overlapping `city and borough` branch went. */
const PREVIOUS =
  /(?:\s+(?:city|town|village|borough|municipality|CDP|comunidad|zona urbana|consolidated government|metro government|metropolitan government|unified government|corporation|plantation|charter township|township|city and borough|and borough|balance))+$/i;

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

  it('strips exactly what the previous pattern stripped', () => {
    const classes = ['city and borough', 'and borough', 'city', 'borough', 'township', 'balance'];
    const names = ['Sitka', 'Bear Creek', 'X'];
    const cases: string[] = [];
    for (const name of names) {
      for (const first of classes) {
        cases.push(`${name} ${first}`);
        for (const second of classes) {
          cases.push(`${name} ${first} ${second}`);
        }
      }
    }

    for (const raw of cases) {
      expect(stripPlaceClass(raw), raw).toBe(raw.replace(PREVIOUS, '').trim());
    }
  });

  it('does not backtrack exponentially on a run of classes that almost matches', () => {
    // The previous pattern parsed each `city and borough` two ways: 2^40 here.
    const hostile = `X${' city and borough'.repeat(40)}!`;
    const started = performance.now();

    expect(stripPlaceClass(hostile)).toBe(hostile);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
