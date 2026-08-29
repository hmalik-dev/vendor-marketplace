import { MAX_GUEST_COUNT } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { parseGuestCountParam } from './guest-count';

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
