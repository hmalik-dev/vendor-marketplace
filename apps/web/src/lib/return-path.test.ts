import { describe, expect, it } from 'vitest';
import { RETURN_PATH_PARAM, safeReturnPath, signInPathReturningTo } from './return-path';

/*
 * #116. This is the open-redirect boundary for the sign-in round trip: the
 * value is attacker-writable and ends up in a redirect, so the rejection cases
 * matter more than the acceptance one.
 *
 * The hostile inputs are built from char codes rather than written as escapes,
 * so what each one actually contains is unambiguous in the source.
 */
const BACKSLASH = String.fromCharCode(92);
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

describe('safeReturnPath', () => {
  it('keeps a same-origin path, query and all', () => {
    expect(safeReturnPath('/vendors/june-harlow/request?package=abc&date=2026-12-05')).toBe(
      '/vendors/june-harlow/request?package=abc&date=2026-12-05',
    );
    expect(safeReturnPath('/bookings')).toBe('/bookings');
  });

  it.each([
    ['an absolute http URL', 'http://evil.test/steal'],
    ['an absolute https URL', 'https://evil.test/steal'],
    ['our own origin written absolutely', 'https://orla.test/bookings'],
    ['a scheme-relative URL', '//evil.test/steal'],
    ['an encoded scheme-relative URL', '%2f%2fevil.test'],
    ['a backslash-relative URL', '/' + BACKSLASH + BACKSLASH + 'evil.test'],
    ['a bare backslash path', BACKSLASH + BACKSLASH + 'evil.test'],
    ['a mixed slash-backslash URL', '/' + BACKSLASH + 'evil.test'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,alert'],
    ['a relative path with no leading slash', 'bookings'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it('rejects control characters, which is how a redirect header gets split', () => {
    expect(safeReturnPath('/bookings' + CR + LF + 'Location: https://evil.test')).toBeNull();
    expect(safeReturnPath('/bookings' + LF)).toBeNull();
    expect(safeReturnPath('/bookings' + NUL)).toBeNull();
  });

  it('rejects malformed encoding rather than guessing at it', () => {
    expect(safeReturnPath('/bookings%')).toBeNull();
    expect(safeReturnPath('%E0%A4%A')).toBeNull();
  });

  it('rejects a value long enough to be a payload rather than a path', () => {
    expect(safeReturnPath('/' + 'a'.repeat(512))).toBeNull();
  });

  it.each(['/sign-in', '/sign-up', '/after-sign-in', '/sign-in/factor-one'])(
    'drops %s, which would strand the customer in a loop',
    (value) => {
      expect(safeReturnPath(value)).toBeNull();
    },
  );

  it('rejects nothing at all', () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });
});

describe('signInPathReturningTo', () => {
  it('carries a safe destination in the query', () => {
    const destination = '/vendors/june-harlow/request?package=abc';

    expect(signInPathReturningTo(destination)).toBe(
      `/sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(destination)}`,
    );
  });

  it('falls back to a bare sign-in when the destination is not safe', () => {
    expect(signInPathReturningTo('https://evil.test')).toBe('/sign-in');
    expect(signInPathReturningTo(undefined)).toBe('/sign-in');
  });
});
