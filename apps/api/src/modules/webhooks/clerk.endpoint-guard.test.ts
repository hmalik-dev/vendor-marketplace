import { describe, expect, it } from 'vitest';
import { assertWebhookEndpoint, checkWebhookEndpoint } from './clerk.endpoint-guard.js';

const HOST = 'vendor-marketplace-production.up.railway.app';
const ORIGIN = `https://${HOST}`;
const GOOD = `${ORIGIN}/webhooks/clerk`;
/** The exact value that was configured on the Clerk app for weeks. */
const RELAY = 'https://webhooks.clerk.com/in/c_2BrebQnWkQ/';

describe('checkWebhookEndpoint', () => {
  it('accepts this deployment’s own webhook route', () => {
    expect(checkWebhookEndpoint(GOOD, ORIGIN)).toEqual({ ok: true });
  });

  /* The bug itself: a CLI relay token registered as the production endpoint. */
  it('rejects a clerk webhooks listen relay', () => {
    const verdict = checkWebhookEndpoint(RELAY, ORIGIN);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('relay');
  });

  it('rejects a relay even when it is the only thing configured', () => {
    expect(checkWebhookEndpoint(RELAY, undefined).ok).toBe(false);
  });

  /*
   * A stale domain or a colleague's tunnel is just as silent as the relay was,
   * so "not a relay" is not the bar — "is this deployment" is.
   */
  it('rejects a real endpoint that belongs to a different deployment', () => {
    const verdict = checkWebhookEndpoint(
      'https://old-domain.up.railway.app/webhooks/clerk',
      ORIGIN,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('going somewhere else');
  });

  it('rejects the right origin pointed at the wrong route', () => {
    const verdict = checkWebhookEndpoint(`${ORIGIN}/webhooks/stripe`, ORIGIN);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('/webhooks/clerk');
  });

  it('rejects a signing secret travelling over plain HTTP', () => {
    const verdict = checkWebhookEndpoint(
      'http://vendor-marketplace-production.up.railway.app/webhooks/clerk',
      ORIGIN,
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('HTTPS');
  });

  /* The local relay target, which is correct when nothing is deployed. */
  it('allows plain HTTP on localhost', () => {
    expect(checkWebhookEndpoint('http://localhost:4000/webhooks/clerk', undefined)).toEqual({
      ok: true,
    });
  });

  it.each([undefined, '', '   '])('rejects %p as unconfigured', (endpoint) => {
    const verdict = checkWebhookEndpoint(endpoint, ORIGIN);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain('No Clerk webhook endpoint');
  });

  it('rejects a value that is not a URL at all', () => {
    expect(checkWebhookEndpoint('c_2BrebQnWkQ', ORIGIN).ok).toBe(false);
  });
});

describe('assertWebhookEndpoint', () => {
  const deployed = { RAILWAY_PUBLIC_DOMAIN: 'vendor-marketplace-production.up.railway.app' };

  it('refuses to boot a deployment whose webhooks go to a relay', () => {
    expect(() => assertWebhookEndpoint(RELAY, deployed)).toThrow(/relay/);
  });

  it('boots when the endpoint is this deployment', () => {
    expect(() => assertWebhookEndpoint(GOOD, deployed)).not.toThrow();
  });

  /*
   * Locally, `clerk webhooks listen` forwarding to a relay is exactly right,
   * so the guard must not turn correct local setup into a failure to start.
   */
  it('stays silent off a platform, where a relay is the correct setup', () => {
    expect(() => assertWebhookEndpoint(RELAY, {})).not.toThrow();
  });

  it('names the variable to fix in the failure', () => {
    expect(() => assertWebhookEndpoint(RELAY, deployed)).toThrow(/CLERK_WEBHOOK_ENDPOINT/);
  });

  /*
   * The defect this closes: the guard keyed off `RAILWAY_PUBLIC_DOMAIN`, so on
   * Vercel, on Render and in the API's own container it returned before
   * checking anything. A stale endpoint on the production Clerk app then went
   * undetected — `user.deleted` never arrives, and a deleted Clerk account
   * keeps a live `users` row and a working session.
   */
  it.each([
    ['Vercel', { VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: HOST }],
    ['Render', { RENDER: 'true', RENDER_EXTERNAL_URL: ORIGIN }],
    [
      'a host that only declares itself',
      { DEPLOYMENT_PLATFORM: 'Netlify', DEPLOYMENT_ORIGIN: HOST },
    ],
    ['a container that only sets NODE_ENV', { NODE_ENV: 'production', DEPLOYMENT_ORIGIN: HOST }],
  ])('runs on %s, not only on Railway', (_platform, source) => {
    expect(() => assertWebhookEndpoint(RELAY, source)).toThrow(/relay/);
  });

  /*
   * The origin comparison is the strongest check the guard has — a tunnel, a
   * stale domain and a colleague's preview are all endpoints that *work* and
   * are still the wrong one. Widening the guard to every deployment must not
   * quietly turn it into an optional check on a host that announces no origin.
   */
  it('refuses to boot a deployment that announces no origin and declares none', () => {
    expect(() => assertWebhookEndpoint(GOOD, { NODE_ENV: 'production' })).toThrow(
      /DEPLOYMENT_ORIGIN/,
    );
  });

  /*
   * `checkWebhookEndpoint` exempts a loopback host from its HTTPS rule, because
   * a local relay target is legitimately plain http. On a deployment it is not
   * — and the check is on the parsed hostname, so every spelling is caught.
   */
  it.each([
    'http://localhost:4000/webhooks/clerk',
    'http://LOCALHOST:4000/webhooks/clerk',
    'https://127.0.0.1/webhooks/clerk',
    'https://[::1]/webhooks/clerk',
  ])('refuses %s on a deployment', (endpoint) => {
    expect(() =>
      assertWebhookEndpoint(endpoint, { NODE_ENV: 'production', DEPLOYMENT_ORIGIN: HOST }),
    ).toThrow(/no deployment can reach/);
  });

  it('does not mistake a query string mentioning localhost for a loopback endpoint', () => {
    expect(() =>
      assertWebhookEndpoint(`${GOOD}?note=//localhost`, { RAILWAY_PUBLIC_DOMAIN: HOST }),
    ).not.toThrow();
  });

  it('refuses a deployment with no endpoint configured at all', () => {
    expect(() =>
      assertWebhookEndpoint(undefined, { NODE_ENV: 'production', DEPLOYMENT_ORIGIN: HOST }),
    ).toThrow(/No Clerk webhook endpoint/);
  });
});
