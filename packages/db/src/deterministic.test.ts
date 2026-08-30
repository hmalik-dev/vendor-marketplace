import { describe, expect, it } from 'vitest';

import { deterministicUuid, hashString, makeRandom, pick } from './deterministic.js';

describe('makeRandom', () => {
  it('produces the same stream for the same seed', () => {
    const first = makeRandom(42);
    const second = makeRandom(42);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it('produces a different stream for a different seed', () => {
    expect(makeRandom(1)()).not.toEqual(makeRandom(2)());
  });

  it('stays inside the unit interval', () => {
    const random = makeRandom(hashString('unit-interval'));

    for (let index = 0; index < 500; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('hashString', () => {
  it('is stable across calls', () => {
    expect(hashString('june-harlow')).toBe(hashString('june-harlow'));
  });

  it('separates strings that differ by one character', () => {
    expect(hashString('vendor-1')).not.toBe(hashString('vendor-2'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const value of ['', 'a', 'photography', 'éèê']) {
      const hash = hashString(value);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('deterministicUuid', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('is well formed, carrying the version and variant bits', () => {
    expect(deterministicUuid('demo.vendor', 'june-harlow')).toMatch(UUID);
  });

  it('returns the same id for the same namespace and key', () => {
    expect(deterministicUuid('demo.vendor', 'june-harlow')).toBe(
      deterministicUuid('demo.vendor', 'june-harlow'),
    );
  });

  it('separates the same key in different namespaces', () => {
    expect(deterministicUuid('demo.vendor', 'shared-key')).not.toBe(
      deterministicUuid('demo.customer', 'shared-key'),
    );
  });

  it('separates different keys in one namespace', () => {
    expect(deterministicUuid('demo.vendor', 'a')).not.toBe(deterministicUuid('demo.vendor', 'b'));
  });

  it('does not collide across a realistic key space', () => {
    const ids = new Set<string>();

    for (let index = 0; index < 5000; index += 1) {
      ids.add(deterministicUuid('demo.booking', `booking-${index}`));
    }

    expect(ids.size).toBe(5000);
  });
});

describe('pick', () => {
  const items = ['a', 'b', 'c', 'd'] as const;

  it('chooses the same item for the same stream', () => {
    expect(pick(items, makeRandom(7))).toBe(pick(items, makeRandom(7)));
  });

  it('only ever returns a member of the list', () => {
    const random = makeRandom(hashString('pick-membership'));

    for (let index = 0; index < 200; index += 1) {
      expect(items).toContain(pick(items, random));
    }
  });

  it('reaches every item given enough draws', () => {
    const random = makeRandom(hashString('pick-coverage'));
    const seen = new Set<string>();

    for (let index = 0; index < 200; index += 1) {
      seen.add(pick(items, random));
    }

    expect(seen.size).toBe(items.length);
  });

  it('refuses an empty list rather than returning undefined', () => {
    expect(() => pick([], makeRandom(1))).toThrow(/empty list/i);
  });
});
