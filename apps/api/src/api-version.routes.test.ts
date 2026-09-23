import { API_VERSION_PREFIX } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LANE_MAILBOX_PATH } from './plugins/email.js';
import { createTestHarness, type TestHarness } from './testing/test-server.js';

/**
 * VEN-650 — one version prefix over every route, except the ones something
 * outside the app calls by a fixed address: the probes and the webhook URLs
 * registered in the provider consoles.
 */
describe('the API version prefix', () => {
  const routes: string[] = [];
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ onRoute: (route) => routes.push(route.url) });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('serves everything under /v1 but the probes and the webhooks', () => {
    expect(API_VERSION_PREFIX).toBe('/v1');

    const unversioned = new Set(routes.filter((url) => !url.startsWith(`${API_VERSION_PREFIX}/`)));

    expect(unversioned).toEqual(
      new Set([
        '/health',
        '/ready',
        '/webhooks/stripe',
        '/webhooks/resend',
        // The CORS preflight, which answers OPTIONS for every path, `/v1` included.
        '*',
        // Lane tooling the email plugin registers off a deployment only; not part of the API.
        LANE_MAILBOX_PATH,
      ]),
    );
    expect(routes.filter((url) => url.startsWith(`${API_VERSION_PREFIX}/`)).length).toBeGreaterThan(
      100,
    );
  });

  it('answers a route under the prefix, and no longer at the root', async () => {
    const versioned = await harness.app.inject({ method: 'GET', url: '/v1/categories' });
    const bare = await harness.app.inject({ method: 'GET', url: '/categories' });

    expect(versioned.statusCode).toBe(200);
    expect(bare.statusCode).toBe(404);
  });

  it('keeps the probes and the webhooks at their fixed addresses', async () => {
    expect((await harness.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await harness.app.inject({ method: 'GET', url: '/v1/health' })).statusCode).toBe(404);
    // Unsigned, so refused — but refused by the webhook, not by a missing route.
    const stripe = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: {},
    });
    expect(stripe.statusCode).not.toBe(404);
  });
});
