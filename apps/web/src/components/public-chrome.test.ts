import { describe, expect, it } from 'vitest';
import { isAppRoute } from './public-chrome';

/**
 * Which routes wear the marketplace's public chrome, and which are the
 * application.
 *
 * The distinction is not "is the user signed in" — a signed-in customer still
 * gets the footer on a vendor profile, because that page is the public face and
 * it is the same page a stranger sees.
 */
describe('isAppRoute', () => {
  it.each([
    '/bookings',
    '/bookings/8f2c1e64-2f4e-4a1a-9a3f-2f9c0d4b7e11',
    '/customer/dashboard',
    '/messages',
    '/vendor/dashboard',
    '/vendor/profile/edit',
  ])('treats %s as the application', (pathname) => {
    expect(isAppRoute(pathname)).toBe(true);
  });

  it.each(['/', '/search', '/vendors/kessler-co', '/sign-up', '/about'])(
    'treats %s as the public face',
    (pathname) => {
      expect(isAppRoute(pathname)).toBe(false);
    },
  );

  /*
   * #192. `/vendors/…` is the public directory and `/vendor/…` is the vendor's
   * own workspace — one letter apart, and the prefix list only carried the
   * second. `'/vendors/kessler-co/request'.startsWith('/vendor/')` is false
   * (index 7 is `s`, not `/`), so the request screen fell through to the public
   * branch and rendered the marketing footer under itself. Frame `04` ends at
   * the rail's "Continue to review"; there is no footer beneath it.
   */
  it('treats a vendor profile as public but its request screen as the application', () => {
    expect(isAppRoute('/vendors/kessler-co')).toBe(false);
    expect(isAppRoute('/vendors/kessler-co/request')).toBe(true);
  });

  /*
   * The pair above would both pass a naive `includes('/request')`, and so would
   * a public page that merely happened to contain the word. The rule is
   * positional: exactly `/vendors/<slug>/request`, nothing deeper and nothing
   * else on the way.
   */
  it('does not treat a lookalike path as the request screen', () => {
    expect(isAppRoute('/vendors/kessler-co/requests')).toBe(false);
    expect(isAppRoute('/vendors/kessler-co/request/extra')).toBe(false);
    expect(isAppRoute('/vendors/request')).toBe(false);
    expect(isAppRoute('/request')).toBe(false);
  });
});
