import { describe, expect, it } from 'vitest';
import { expectLinearTime } from '../test-support/linear-time.js';
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

  it('redacts the web tier headers, which name a visitor and prove the caller', () => {
    const { request, ...rest } = leakyEvent();
    const event = {
      ...rest,
      request: {
        ...request,
        headers: { 'x-web-tier-key': 'proof', 'x-visitor-ip': '203.0.113.9' },
      },
    };

    expect(scrubErrorEvent(event).request?.headers).toEqual({
      'x-web-tier-key': REDACTED,
      'x-visitor-ip': REDACTED,
    });
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

describe('scrubErrorEvent: what the scrub fixture must never carry', () => {
  // A stream ticket is 43 opaque characters, so no credential shape matches it.
  const STREAM_TICKET = 'Zk3xQ9vL2mN8pR4tY7wB1cD5fG6hJ0kA_s-Ue3XoIiE';
  const WEBHOOK_SECRET = ['whsec', 'fixtureSigningSecret0123'].join('_');
  const LIVE_KEY = ['sk', 'live', 'fixtureLiveKeyValue0123'].join('_');
  const PHONE = '(415) 555-0132';
  const E164_PHONE = '+14155550132';
  const CUSTOMER_ID = ['cus', 'Qx7fixtureCustomer'].join('_');
  const ACCOUNT_ID = ['acct', '1Fixture0Account'].join('_');

  function fixtureEvent() {
    return {
      message: `Call ${PHONE} or ${E164_PHONE}; key ${LIVE_KEY}; signing ${WEBHOOK_SECRET}`,
      request: {
        url: 'https://api.example.test/bookings',
        headers: { Authorization: `Bearer ${LIVE_KEY}`, Cookie: '__session=abc' },
        cookies: { __session: 'abc' },
      },
      breadcrumbs: [
        {
          category: 'fetch',
          data: {
            url: `https://api.example.test/stream?ticket=${STREAM_TICKET}`,
            method: 'GET',
          },
        },
        { category: 'navigation', data: { from: `/x?ticket=${STREAM_TICKET}`, to: '/y' } },
        { message: `retrieved ${CUSTOMER_ID} on ${ACCOUNT_ID}` },
      ],
      transaction: `GET /stream?ticket=${STREAM_TICKET}`,
      extra: { href: `/stream?ticket=${STREAM_TICKET}&after=3` },
    };
  }

  it('leaves none of them in the serialised event', () => {
    const serialized = JSON.stringify(scrubErrorEvent(fixtureEvent()));

    for (const leaked of [
      PHONE,
      E164_PHONE,
      LIVE_KEY,
      WEBHOOK_SECRET,
      STREAM_TICKET,
      CUSTOMER_ID,
      ACCOUNT_ID,
      '__session=abc',
    ]) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('keeps the route and the parameter names, so the breadcrumb still explains itself', () => {
    const scrubbed = scrubErrorEvent(fixtureEvent());

    expect(scrubbed.breadcrumbs).toMatchObject([
      { data: { url: `https://api.example.test/stream?ticket=${REDACTED}`, method: 'GET' } },
      { data: { from: `/x?ticket=${REDACTED}`, to: '/y' } },
      { message: `retrieved ${REDACTED} on ${REDACTED}` },
    ]);
    expect(scrubbed.extra).toEqual({ href: `/stream?ticket=${REDACTED}&after=${REDACTED}` });
  });

  it('catches the other shapes a phone number is typed in, and a bare query string', () => {
    const scrubbed = scrubErrorEvent({
      ...fixtureEvent(),
      message: `(415)555-0132 | +44 20 7946 0958 | 415-555-0132 | ticket=${STREAM_TICKET}&after=3`,
    });

    expect(scrubbed.message).toBe(
      `${REDACTED} | ${REDACTED} | ${REDACTED} | ticket=${REDACTED}&after=${REDACTED}`,
    );
  });

  it('does not mistake a timestamp or an id for a phone number', () => {
    const scrubbed = scrubErrorEvent({
      ...fixtureEvent(),
      message: 'at 1726790000000 for 2026-09-20 booking 1234567',
    });

    expect(scrubbed.message).toBe('at 1726790000000 for 2026-09-20 booking 1234567');
  });
});

describe('scrubErrorEvent: credential shapes and hostile input (VEN-674)', () => {
  const scrubMessage = (message: string) => {
    const event = { user: { id: 'user_1' }, message };

    return scrubErrorEvent(event).message;
  };

  it.each([
    ['a JWT', `session ${SESSION_JWT} ended`, 'session [redacted] ended'],
    ['a Bearer token', 'sent Bearer abc123def456 today', 'sent [redacted] today'],
    ['a server key', `bad key ${SERVER_KEY} used`, 'bad key [redacted] used'],
    [
      'a signing secret',
      `bad ${['whsec', 'fixtureValueForScrub'].join('_')} used`,
      'bad [redacted] used',
    ],
    ['a customer id', `for ${['cus', 'Fixture12345'].join('_')} now`, 'for [redacted] now'],
    ['a connected account id', `on ${['acct', 'Fixture12345'].join('_')} now`, 'on [redacted] now'],
  ])('still redacts %s', (_label, input, expected) => {
    expect(scrubMessage(input)).toBe(expected);
  });

  it('redacts a JWT that follows a delimiter without eating the delimiter', () => {
    expect(scrubMessage(`a=${SESSION_JWT},b=${SESSION_JWT}`)).toBe('a=[redacted],b=[redacted]');
  });

  it.each([
    ['a percent-encoded space', `${EMAIL}%20${EMAIL}`],
    ['a plus', `${EMAIL}+${EMAIL}`],
    ['a comma', `${EMAIL},${EMAIL}`],
    ['an underscore', `${EMAIL}_to_${EMAIL}`],
  ])('redacts two addresses joined by %s', (_label, input) => {
    expect(scrubMessage(input)).not.toContain('@');
  });

  it('redacts a JWT after a percent-encoded prefix', () => {
    expect(scrubMessage(`Bearer%20${SESSION_JWT}`)).toBe('Bearer%20[redacted]');
    expect(scrubMessage(`%22${SESSION_JWT}%22`)).toBe('%22[redacted]%22');
    expect(scrubMessage(`__session%3D${SESSION_JWT} dropped`)).toBe(
      '__session%3D[redacted] dropped',
    );
  });

  it.each([
    ['a run of a', (size: number) => 'a'.repeat(size)],
    ['a run of ?', (size: number) => '?'.repeat(size)],
    ['a run of ?a', (size: number) => '?a'.repeat(size / 2)],
    ['a run of eyJ', (size: number) => 'eyJ'.repeat(Math.ceil(size / 3))],
    ['a run of -eyJ', (size: number) => '-eyJ'.repeat(Math.ceil(size / 4))],
    ['a run of eyJa.', (size: number) => 'eyJa.'.repeat(Math.ceil(size / 5))],
  ])('scrubs %s in linear time', (_label, hostile) => {
    expectLinearTime(hostile, scrubMessage);
  });
});

describe('scrubErrorEvent: surfaces beyond `request` (VEN-522)', () => {
  const OPAQUE = 'OPAQUE123';
  const IPV4_ADDRESS = '198.51.100.7';
  const IPV6_ADDRESS = '2001:db8::8a2e:370:7334';

  function surfaceEvent() {
    return {
      message: `Refused ${IPV4_ADDRESS} and ${IPV6_ADDRESS} at 12:30:45`,
      request: {
        url: 'https://api.example.test/customer/bookings/1',
        headers: {
          'x-vercel-forwarded-for': IPV4_ADDRESS,
          'cf-connecting-ip': IPV4_ADDRESS,
          'true-client-ip': IPV4_ADDRESS,
          'x-vercel-ip-city': 'Springfield',
          'x-vercel-ip-country': 'US',
          'x-vercel-ip-country-region': 'IL',
          'cf-ipcountry': 'US',
          'cf-ray': '8a1b2c3d4e5f-LHR',
          'x-request-id': 'req_1',
        },
        env: { REMOTE_ADDR: IPV4_ADDRESS, SERVER_NAME: 'api' },
      },
      breadcrumbs: [{ data: { url: `https://api/x/stream?ticket=${OPAQUE}` } }],
      spans: [
        {
          data: {
            'url.full': `https://api/x/stream?ticket=${OPAQUE}`,
            'http.query': `ticket=${OPAQUE}`,
          },
        },
      ],
      contexts: { trace: { data: { 'http.query': `ticket=${OPAQUE}&after=3` } } },
      transaction: `GET /invite/${OPAQUE}`,
      exception: { values: [{ type: 'Error', value: `no such /invite/${OPAQUE}/accept` }] },
      extra: { token: OPAQUE, note: 'kept', nested: { inviteTicket: OPAQUE, count: 3 } },
    };
  }

  it('leaves no opaque value or address anywhere in the serialised event', () => {
    const serialized = JSON.stringify(scrubErrorEvent(surfaceEvent()));

    expect(serialized).not.toContain(OPAQUE);
    expect(serialized).not.toContain(IPV4_ADDRESS);
    expect(serialized).not.toContain(IPV6_ADDRESS);
  });

  it('cleans breadcrumb, span and trace URLs and queries', () => {
    const scrubbed = scrubErrorEvent(surfaceEvent());

    expect(scrubbed.breadcrumbs).toEqual([
      { data: { url: `https://api/x/stream?ticket=${REDACTED}` } },
    ]);
    expect(scrubbed.spans).toEqual([
      { data: { 'url.full': `https://api/x/stream?ticket=${REDACTED}`, 'http.query': REDACTED } },
    ]);
    expect(scrubbed.contexts).toEqual({ trace: { data: { 'http.query': REDACTED } } });
  });

  it('withholds the IP and location headers and drops request.env', () => {
    const { request } = scrubErrorEvent(surfaceEvent());

    expect(request).toEqual({
      url: 'https://api.example.test/customer/bookings/1',
      headers: {
        'x-vercel-forwarded-for': REDACTED,
        'cf-connecting-ip': REDACTED,
        'true-client-ip': REDACTED,
        'x-vercel-ip-city': REDACTED,
        'x-vercel-ip-country': REDACTED,
        'x-vercel-ip-country-region': REDACTED,
        'cf-ipcountry': REDACTED,
        'cf-ray': REDACTED,
        'x-request-id': 'req_1',
      },
    });
  });

  it('redacts an IPv6 address that follows a colon', () => {
    const scrubbed = scrubErrorEvent({
      ...surfaceEvent(),
      message: `remoteAddress:${IPV6_ADDRESS} at 1:02:03`,
    });

    expect(scrubbed.message).toBe(`remoteAddress:${REDACTED} at 1:02:03`);
  });

  it('redacts addresses in text but not a clock time, and path and key-named credentials', () => {
    const scrubbed = scrubErrorEvent(surfaceEvent());

    expect(scrubbed.message).toBe(`Refused ${REDACTED} and ${REDACTED} at 12:30:45`);
    expect(scrubbed.transaction).toBe(`GET /invite/${REDACTED}`);
    expect(scrubbed.exception).toEqual({
      values: [{ type: 'Error', value: `no such /invite/${REDACTED}/accept` }],
    });
    expect(scrubbed.extra).toEqual({
      token: REDACTED,
      note: 'kept',
      nested: { inviteTicket: REDACTED, count: 3 },
    });
  });
});
