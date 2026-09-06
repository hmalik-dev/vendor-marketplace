import { MAX_GUEST_COUNT } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { guestCountFromInput, parseGuestCountParam } from './guest-count';

/*
 * #116 carries `?guests=` from the profile rail into the booking request, so
 * it is a route-boundary value: attacker-writable, and dropped rather than
 * rendered when it is not a plain whole number in range.
 */
describe('parseGuestCountParam', () => {
  it('keeps a whole number in range', () => {
    expect(parseGuestCountParam('120')).toBe('120');
    expect(parseGuestCountParam('1')).toBe('1');
    expect(parseGuestCountParam(String(MAX_GUEST_COUNT))).toBe(String(MAX_GUEST_COUNT));
  });

  it.each([
    ['a trailing-garbage prefix parseInt would accept', '120abc'],
    ['leading whitespace', ' 120'],
    ['an explicit sign', '+120'],
    ['a leading zero', '0120'],
    ['exponent notation', '1e3'],
    ['a decimal', '12.5'],
    ['a negative', '-5'],
    ['zero', '0'],
    ['over the cap', String(MAX_GUEST_COUNT + 1)],
    ['an overflowing number', '999999999999'],
    ['a word', 'many'],
    ['an empty string', ''],
    ['an injection attempt', '120<script>'],
  ])('drops %s', (_label, value) => {
    expect(parseGuestCountParam(value)).toBe('');
  });

  it('drops an absent parameter', () => {
    expect(parseGuestCountParam(undefined)).toBe('');
  });
});

/**
 * The form's half of the same rule (#412). The two differ in exactly one way
 * and the difference is deliberate: a URL carrying `050` is a stale or
 * hand-made link, while `050` in an input is a whole number somebody typed.
 */
describe('guestCountFromInput', () => {
  it.each([
    ['120', 120],
    ['1', 1],
    ['100000', MAX_GUEST_COUNT],
    // The one shape it accepts that the URL parser refuses.
    ['050', 50],
  ])('reads %s as %i', (typed, expected) => {
    expect(guestCountFromInput(typed)).toBe(expected);
  });

  it.each(['2.7', '1e21', '1e400', '120abc', '-5', '0', '100001', '', ' 120', '+120'])(
    'refuses %s rather than reading a prefix of it',
    (typed) => {
      expect(guestCountFromInput(typed)).toBeNull();
    },
  );

  it('refuses everything `Number.parseInt` would have truncated', () => {
    // The defect: `parseInt` answered 2 for '2.7' and 1 for '1e21'.
    expect(Number.parseInt('2.7', 10)).toBe(2);
    expect(Number.parseInt('1e21', 10)).toBe(1);
    expect(guestCountFromInput('2.7')).toBeNull();
    expect(guestCountFromInput('1e21')).toBeNull();
  });

  it('stays stricter than the URL parser only about the leading zero', () => {
    expect(parseGuestCountParam('050')).toBe('');
    expect(guestCountFromInput('050')).toBe(50);
  });
});
