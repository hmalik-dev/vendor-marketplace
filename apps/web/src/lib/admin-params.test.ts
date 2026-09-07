import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, MAX_PAGE } from '@vendor-marketplace/shared';
import {
  boundedText,
  droppedFiltersLine,
  droppedKeys,
  oneOf,
  pageNumber,
  uuidParam,
} from './admin-params';

describe('oneOf', () => {
  it('returns the value when it is in the vocabulary', () => {
    expect(oneOf('review', ['live', 'review'] as const)).toBe('review');
  });

  it('drops anything the vocabulary does not contain', () => {
    // The class of defect: an unknown value forwarded to the API is a 400,
    // and a 400 the console does not handle is the 500 page.
    for (const hostile of ['REVIEW', 'live;drop', '', undefined, '__proto__']) {
      expect(oneOf(hostile, ['live', 'review'] as const), String(hostile)).toBeUndefined();
    }
  });
});

describe('boundedText', () => {
  it('trims and keeps a normal term', () => {
    expect(boundedText('  kessler ')).toBe('kessler');
  });

  it('drops an empty or whitespace-only term rather than sending `q=`', () => {
    expect(boundedText('   ')).toBeUndefined();
    expect(boundedText(undefined)).toBeUndefined();
  });

  it('truncates to the cap the API enforces', () => {
    const long = 'a'.repeat(MAX_NAME_LENGTH + 200);

    expect(boundedText(long)).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('pageNumber', () => {
  it('reads a real page', () => {
    expect(pageNumber('4')).toBe(4);
  });

  it('falls back to page 1 for every value the API would refuse', () => {
    for (const hostile of [
      '0',
      '-3',
      'abc',
      '1.5',
      '',
      undefined,
      String(MAX_PAGE + 1),
      '2147483648',
    ]) {
      expect(pageNumber(hostile), String(hostile)).toBe(1);
    }
  });

  it('accepts the ceiling itself', () => {
    expect(pageNumber(String(MAX_PAGE))).toBe(MAX_PAGE);
  });
});

describe('a repeated parameter', () => {
  /*
   * The class of defect: Next hands a page `string[]` for `?q=a&q=b`, and
   * `.trim()` on an array is a TypeError during the server render — a 500 for a
   * URL anyone can paste. Every reader takes the array shape for that reason.
   */
  it('is read as its first value rather than crashing the render', () => {
    expect(boundedText(['kessler', 'ignored'])).toBe('kessler');
    expect(pageNumber(['3', '9'])).toBe(3);
    expect(oneOf(['review', 'live'], ['live', 'review'] as const)).toBe('review');
  });

  it('survives an empty array, which is what a bare `?q=` repeated can produce', () => {
    expect(boundedText([])).toBeUndefined();
    expect(pageNumber([])).toBe(1);
    expect(oneOf([], ['live'] as const)).toBeUndefined();
  });
});

describe('droppedKeys and droppedFiltersLine', () => {
  it('names a filter that was supplied but not usable', () => {
    const dropped = droppedKeys(
      { status: 'banned', city: 'Austin' },
      { status: undefined, city: 'Austin' },
    );

    expect(dropped).toEqual(['status']);
    expect(droppedFiltersLine(dropped)).toBe(
      'Ignored status in the address — it is not a value this list can filter by.',
    );
  });

  it('says nothing when everything survived', () => {
    expect(droppedKeys({ city: 'Austin' }, { city: 'Austin' })).toEqual([]);
    expect(droppedFiltersLine([])).toBeNull();
  });

  it('does not report a key that was never supplied', () => {
    expect(droppedKeys({}, { status: undefined })).toEqual([]);
  });

  it('joins several into one sentence', () => {
    expect(droppedFiltersLine(['status', 'city', 'payouts'])).toBe(
      'Ignored status, city and payouts in the address — they are not values this list can filter by.',
    );
  });
});

describe('every console screen can say what it ignored', () => {
  /*
   * The rule is "drop it **and say so**". Silently rendering the unfiltered
   * list tells an operator the platform holds data it does not — which on a
   * moderation queue is the difference between "nothing is waiting" and "your
   * URL was wrong".
   */
  it('reports the key an operator supplied and the screen could not use', () => {
    const raw = { status: 'nonsense', page: '2' };
    const parsed = { status: undefined };

    expect(droppedFiltersLine(droppedKeys(raw, parsed))).toBe(
      'Ignored status in the address — it is not a value this list can filter by.',
    );
  });

  it('says nothing about a key the screen never parses', () => {
    // `page` is narrowed by `pageNumber`, which always yields a number — it is
    // not a filter and must never appear in the line.
    expect(droppedKeys({ page: 'abc' }, { status: undefined })).toEqual([]);
  });
});

/**
 * The action log's two identity filters (#434).
 *
 * These are the only console filters that take an id rather than a member of a
 * closed vocabulary, so `oneOf` cannot narrow them and `uuidParam` is the whole
 * guard. The defect it exists to stop: `?actor=nonsense` forwarded to an API
 * that validates `z.uuid()`, which answers 400 — and an unhandled 400 in a
 * Server Component is the 500 page, for a URL anyone can paste into Slack.
 */
describe('uuidParam', () => {
  const REAL = '3f8b1c2e-1c4a-4b7d-9f2e-0a1b2c3d4e5f';

  it('returns a well-formed uuid unchanged', () => {
    expect(uuidParam(REAL)).toBe(REAL);
  });

  it.each([
    ['nonsense', 'not-a-uuid'],
    ['an empty string', ''],
    ['a bare number', '12345'],
    ['a uuid missing a group', '3f8b1c2e-1c4a-4b7d-9f2e'],
    ['a uuid with a non-hex character', '3f8b1c2e-1c4a-4b7d-9f2e-0a1b2c3d4e5g'],
    ['a long paste', 'A'.repeat(300)],
    ['a SQL fragment', "' OR 1=1 --"],
  ])('drops %s', (_label, value) => {
    expect(uuidParam(value)).toBeUndefined();
  });

  it('drops a missing parameter', () => {
    expect(uuidParam(undefined)).toBeUndefined();
  });

  /*
   * `?actor=a&actor=b` arrives as an array. Typing the prop as `string` is how
   * this becomes a `TypeError` during the server render — see `RawParam`.
   */
  it('reads the first value of a repeated parameter', () => {
    expect(uuidParam([REAL, 'nonsense'])).toBe(REAL);
    expect(uuidParam(['nonsense', REAL])).toBeUndefined();
  });

  /*
   * The reason this defers to the shared `uuidSchema` rather than carrying a
   * regex of its own: a hand-rolled pattern rejected these two, which
   * `z.uuid()` accepts. The screen would then have dropped a value the API
   * would have taken, and told the operator — wrongly — that it was not
   * something this list can filter by.
   */
  it('accepts the edge uuids the API accepts', () => {
    expect(uuidParam('00000000-0000-0000-0000-000000000000')).toBe(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(uuidParam('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    );
  });
});
