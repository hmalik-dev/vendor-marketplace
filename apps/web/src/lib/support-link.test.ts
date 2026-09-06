import { SUPPORT_PATH, supportErrorContextSchema } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import {
  SUPPORT_ERROR_AT_PARAM,
  SUPPORT_ERROR_DIGEST_PARAM,
  SUPPORT_ERROR_ROUTE_PARAM,
  scrubbedRoute,
  supportLink,
} from './support-link';

const CONTEXT = {
  digest: 'err_9f4c2a71b3',
  route: '/bookings/abc/checkout',
  occurredAt: '2026-06-12T14:41:00.000Z',
} as const;

describe('supportLink', () => {
  it('carries the digest, route and moment into the query', () => {
    const query = new URLSearchParams(supportLink(CONTEXT).split('?')[1]);

    expect(query.get(SUPPORT_ERROR_DIGEST_PARAM)).toBe(CONTEXT.digest);
    expect(query.get(SUPPORT_ERROR_ROUTE_PARAM)).toBe(CONTEXT.route);
    expect(query.get(SUPPORT_ERROR_AT_PARAM)).toBe(CONTEXT.occurredAt);
  });

  /*
   * The whole point of the link. The 500 screen writes these three names and
   * the support page reads them, from opposite halves of the app — so a rename
   * on one side would silently stop attaching the reference and nothing would
   * look broken. This asserts the round trip rather than the spelling.
   */
  it("produces a query the support page's own schema accepts", () => {
    const query = new URLSearchParams(supportLink(CONTEXT).split('?')[1]);

    const parsed = supportErrorContextSchema.safeParse({
      digest: query.get(SUPPORT_ERROR_DIGEST_PARAM),
      route: query.get(SUPPORT_ERROR_ROUTE_PARAM),
      occurredAt: query.get(SUPPORT_ERROR_AT_PARAM),
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual(CONTEXT);
  });

  it('escapes a route that would otherwise break out of the query', () => {
    const link = supportLink({ ...CONTEXT, route: '/search?category=a&b=c' });
    const query = new URLSearchParams(link.split('?')[1]);

    expect(query.get(SUPPORT_ERROR_ROUTE_PARAM)).toBe('/search?category=a&b=c');
    expect(query.get('b')).toBeNull();
  });

  /*
   * An error thrown while rendering on the client was never written to the
   * server log, so there is no entry for support to look up. The link is the
   * bare path rather than one promising a reference that does not exist.
   */
  it('links to the bare path when there is no digest to attach', () => {
    expect(supportLink()).toBe(SUPPORT_PATH);
    expect(supportLink({ route: '/', occurredAt: CONTEXT.occurredAt })).toBe(SUPPORT_PATH);
  });
});

/**
 * The route is copied off `window.location`, and not every parameter in a URL
 * is the app's. Found by the security review of #372: Clerk puts a single-use
 * `__clerk_ticket` on the auth routes, and a crash on exactly that URL would
 * have carried it into a support email and stored it on the message.
 *
 * The query still travels, because `/search?category=x` is what says what
 * broke. What does not travel is anything credential-shaped.
 */
describe('scrubbedRoute', () => {
  it('keeps the path when there is no query at all', () => {
    expect(scrubbedRoute('/bookings/abc/checkout', '')).toBe('/bookings/abc/checkout');
  });

  it("keeps the app's own parameters, which are the useful half", () => {
    expect(scrubbedRoute('/search', '?category=photography&city=Austin&state=TX&page=2')).toBe(
      '/search?category=photography&city=Austin&state=TX&page=2',
    );
  });

  it('drops the Clerk sign-in ticket, which is the case this was written for', () => {
    expect(scrubbedRoute('/sign-in', '?__clerk_ticket=abc.def.ghi&redirect_url=%2Fbookings')).toBe(
      '/sign-in?redirect_url=%2Fbookings',
    );
  });

  it.each([
    'token',
    'access_token',
    'id_token',
    'apiKey',
    'api_key',
    'client_secret',
    'password',
    'signature',
    'credential',
    'invite_ticket',
    'jwt',
    '__session',
  ])('drops %s', (key) => {
    expect(scrubbedRoute('/x', `?${key}=secretvalue&keep=1`)).toBe('/x?keep=1');
  });

  /*
   * `state` is the search bar's US state filter, and it is the one legitimate
   * parameter whose name reads like an OAuth field. Asserted explicitly,
   * because a wider pattern would silently take the city half of every
   * search-related crash report with it.
   */
  it('keeps state, which here is a filter and not an OAuth nonce', () => {
    expect(scrubbedRoute('/search', '?state=TX')).toBe('/search?state=TX');
  });

  it('returns the bare path when every parameter was dropped', () => {
    expect(scrubbedRoute('/sign-in', '?__clerk_ticket=abc')).toBe('/sign-in');
  });

  /*
   * The whole reason this function exists is to feed `route`, which the support
   * page re-validates on arrival — so a scrub that produced something the
   * schema refuses would silently drop the context instead of carrying it.
   */
  it('produces a route the support page still accepts', () => {
    const parsed = supportErrorContextSchema.safeParse({
      digest: CONTEXT.digest,
      route: scrubbedRoute('/search', '?category=photography&__clerk_ticket=abc'),
      occurredAt: CONTEXT.occurredAt,
    });

    expect(parsed.success).toBe(true);
  });
});
