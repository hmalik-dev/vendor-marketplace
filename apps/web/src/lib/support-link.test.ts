import { SUPPORT_PATH, supportErrorContextSchema } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import {
  SUPPORT_ERROR_AT_PARAM,
  SUPPORT_ERROR_DIGEST_PARAM,
  SUPPORT_ERROR_ROUTE_PARAM,
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
