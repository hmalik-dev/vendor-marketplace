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

  it('leaves percent sequences encoded instead of decoding them', () => {
    /*
     * The validator deliberately does NOT decode. A stray or malformed percent
     * is kept as a literal path character, which cannot change the origin and
     * cannot become a delimiter — where decoding it could. `%2f` staying `%2f`
     * is the property that makes `/a%2f%2fevil.test` harmless.
     */
    expect(safeReturnPath('/bookings%')).toBe('/bookings%');
    expect(safeReturnPath('/a%2f%2fevil.test')).toBe('/a%2f%2fevil.test');
    expect(new URL(safeReturnPath('/a%2f%2fevil.test') as string, 'https://orla.test').origin).toBe(
      'https://orla.test',
    );
    // Still rejected, because it is not a path at all.
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

  /*
   * Security review, 2026-08-29. The first cut validated a string and then
   * returned a DIFFERENT one: it checked the path before the URL parser
   * normalised it, so dot segments walked past the loop guard, and it returned
   * a decoded value, promoting encoded delimiters into structural ones. The
   * rule these pin is that what is validated must be exactly what is returned.
   */
  describe('normalisation', () => {
    it.each([
      ['a dot segment', '/x/../sign-in'],
      ['a single dot segment', '/./sign-in'],
      ['nested dot segments', '/a/b/../../sign-up'],
      ['a dot segment onto after-sign-in', '/x/../after-sign-in'],
      ['an encoded dot segment', '/x/%2e%2e/sign-in'],
    ])('drops %s that resolves back into the auth flow', (_label, value) => {
      expect(safeReturnPath(value)).toBeNull();
    });

    it('drops a path that normalises to a scheme-relative URL', () => {
      /*
       * `/x/..//evil.test` is not scheme-relative as written, so the leading
       * check passes — but it RESOLVES to `//evil.test`, which any later
       * `new URL(value, origin)` reads as a foreign origin. Returning the
       * normalised form without re-checking would create the open redirect
       * the leading check exists to prevent.
       */
      expect(safeReturnPath('/x/..//evil.test')).toBeNull();
      expect(safeReturnPath('/a/b/../..//evil.test')).toBeNull();
    });

    it('returns exactly the path that will be redirected to', () => {
      const value = '/vendors/june-harlow/request?package=abc';

      expect(safeReturnPath(value)).toBe(value);
      // Resolving the result must not move it again.
      expect(new URL(safeReturnPath(value) as string, 'https://orla.test').pathname).toBe(
        '/vendors/june-harlow/request',
      );
    });

    it('does not promote an encoded delimiter into a structural one', () => {
      /*
       * `%26` and `%3D` are data inside one parameter. Decoding them on the
       * way out injects `foo=bar` as a second parameter into the destination.
       */
      const injected = safeReturnPath('/vendors/june-harlow/request?package=a%26foo%3Dbar');

      expect(injected).not.toBeNull();
      expect(new URL(injected as string, 'https://orla.test').searchParams.get('package')).toBe(
        'a&foo=bar',
      );
      expect(new URL(injected as string, 'https://orla.test').searchParams.get('foo')).toBeNull();
    });
  });
});

describe('RETURN_PATH_PARAM', () => {
  /*
   * `redirect_url` is Clerk's own reserved query key. clerk-js reads it off
   * `window.location` and prefers it over the `fallbackRedirectUrl` prop
   * (`@clerk/shared` `redirectUrls.mjs`, `#getRedirectUrl`), so a destination
   * carried under that name is consumed by Clerk and `/after-sign-in` — which
   * resolves the role, handles a suspended account and re-validates the path —
   * is skipped entirely. The app must carry its own destination under its own
   * key.
   */
  it('is not a key Clerk reserves', () => {
    const CLERK_RESERVED = [
      'redirect_url',
      'after_sign_in_url',
      'after_sign_up_url',
      'sign_in_force_redirect_url',
      'sign_in_fallback_redirect_url',
      'sign_up_force_redirect_url',
      'sign_up_fallback_redirect_url',
      'force_redirect_url',
      'fallback_redirect_url',
    ];

    expect(CLERK_RESERVED).not.toContain(RETURN_PATH_PARAM);
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
