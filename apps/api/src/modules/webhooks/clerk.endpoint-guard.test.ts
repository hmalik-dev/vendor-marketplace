import { describe, expect, it } from 'vitest';
import {
  assertWebhookEndpoint,
  checkWebhookEndpoint,
  deploymentOrigin,
} from './clerk.endpoint-guard.js';

const ORIGIN = 'https://vendor-marketplace-production.up.railway.app';
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

describe('deploymentOrigin', () => {
  it("builds an origin from Railway's domain, which carries no scheme", () => {
    expect(deploymentOrigin({ RAILWAY_PUBLIC_DOMAIN: 'app.up.railway.app' })).toBe(
      'https://app.up.railway.app',
    );
  });

  it.each([{}, { RAILWAY_PUBLIC_DOMAIN: '' }])('has no origin off a platform (%p)', (source) => {
    expect(deploymentOrigin(source)).toBeNull();
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
});
