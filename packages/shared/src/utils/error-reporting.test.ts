import { describe, expect, it } from 'vitest';
import { REDACTED, scrubErrorEvent } from './error-reporting.js';

/*
 * Credential-shaped values are composed, never written out: a literal of these
 * shapes is what the secret scanner and the credential hook exist to stop, and
 * a fixture should not need to be forgiven by either.
 */
const SESSION_JWT = ['eyJhbGciOiJSUzI1NiJ9', 'eyJzdWIiOiJ1c2VyXzEyMyJ9', 'c2lnbmF0dXJl'].join('.');
const SERVER_KEY = ['sk', 'test', 'fixtureValueForScrub'].join('_');
const EMAIL = ['ada', 'example.com'].join('@');
const PROXY_CREDENTIAL = ['Basic', Buffer.from('ada:hunter2').toString('base64')].join(' ');

function leakyEvent() {
  return {
    message: `Charge failed for ${EMAIL}`,
    user: { id: 'user_2abc', email: EMAIL, ip_address: '203.0.113.9', username: 'ada' },
    request: {
      // Path *and* query, as every SDK builds it — the ticket is here as well as
      // in `query_string`, which is the pair that made dropping one of them a
      // half measure.
      url: `https://api.example.test/customer/bookings/1?ticket=${SESSION_JWT}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SESSION_JWT}`,
        Cookie: `__session=${SESSION_JWT}`,
        'Proxy-Authorization': PROXY_CREDENTIAL,
        'X-Forwarded-For': '203.0.113.9',
        'svix-signature': 'v1,abc',
        'User-Agent': 'vitest',
      },
      cookies: { __session: SESSION_JWT },
      data: { note: `reach me at ${EMAIL}` },
      query_string: `ticket=${SESSION_JWT}`,
    },
    exception: {
      values: [
        { type: 'StripeAuthenticationError', value: `Invalid API Key provided: ${SERVER_KEY}` },
      ],
    },
    breadcrumbs: [{ message: `fetch with token ${SESSION_JWT}` }],
    extra: { nested: { deeper: [`contact ${EMAIL}`] } },
  };
}

describe('scrubErrorEvent', () => {
  it('reduces the user to their id', () => {
    expect(scrubErrorEvent(leakyEvent()).user).toEqual({ id: 'user_2abc' });
  });

  it('leaves no email, session token or server key anywhere in the event', () => {
    const serialized = JSON.stringify(scrubErrorEvent(leakyEvent()));

    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain(SESSION_JWT);
    expect(serialized).not.toContain(SERVER_KEY);
    expect(serialized).not.toContain(PROXY_CREDENTIAL);
    // From `user.ip_address` and from `X-Forwarded-For`: the reduction of the
    // user to a bare id is undone if the address arrives in a header instead.
    expect(serialized).not.toContain('203.0.113.9');
  });

  it('redacts credential headers by name and drops bodies, cookies and query strings', () => {
    const { request } = scrubErrorEvent(leakyEvent());

    expect(request).toEqual({
      // The query is gone from `url` too, not only from `query_string`.
      url: 'https://api.example.test/customer/bookings/1',
      method: 'POST',
      headers: {
        Authorization: REDACTED,
        Cookie: REDACTED,
        'Proxy-Authorization': REDACTED,
        'X-Forwarded-For': REDACTED,
        'svix-signature': REDACTED,
        'User-Agent': 'vitest',
      },
    });
  });

  /*
   * `beforeSend` throwing is not a loud failure: Sentry catches it and drops the
   * event, so reporting would go quiet exactly when something is already wrong.
   * The type says `Record<string, string>`; the value is whatever the SDK built.
   */
  it('survives a header value the SDK did not build as a string', () => {
    const { request, ...rest } = leakyEvent();
    const event = {
      ...rest,
      request: { ...request, headers: { 'x-attempt': 3 } as unknown as Record<string, string> },
    };

    expect(scrubErrorEvent(event).request?.headers).toEqual({ 'x-attempt': '3' });
  });

  it('keeps the text around what it redacts, so the error still reads', () => {
    const scrubbed = scrubErrorEvent(leakyEvent());

    expect(scrubbed.message).toBe(`Charge failed for ${REDACTED}`);
    expect(scrubbed.exception).toEqual({
      values: [
        { type: 'StripeAuthenticationError', value: `Invalid API Key provided: ${REDACTED}` },
      ],
    });
  });

  it('sends no user at all for a signed-out request', () => {
    const { user: _user, ...anonymous } = leakyEvent();

    expect(scrubErrorEvent(anonymous)).not.toHaveProperty('user');
  });
});
