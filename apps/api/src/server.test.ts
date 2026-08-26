import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SVIX_HEADERS,
  bearer,
  createTestHarness,
  type TestHarness,
} from './testing/test-server.js';

describe('rate limiting', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('answers a caller past the limit with the structured 429 shape', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.10' };

    const allowed = await Promise.all([
      harness.app.inject({ method: 'GET', url: '/categories', headers }),
      harness.app.inject({ method: 'GET', url: '/categories', headers }),
    ]);
    expect(allowed.map((response) => response.statusCode)).toEqual([200, 200]);

    const blocked = await harness.app.inject({ method: 'GET', url: '/categories', headers });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });
  });

  /*
   * The platform calls the probes far more often than any human calls the API.
   * Counting them against the limit means the limiter eventually answers the
   * probe with a 429, the platform reads that as unhealthy, and the service
   * takes itself down with nothing else wrong.
   */
  it.each(['/health', '/ready'])('never rate limits %s', async (url) => {
    const headers = { 'x-forwarded-for': '203.0.113.20' };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await harness.app.inject({ method: 'GET', url, headers });
      expect(response.statusCode).toBe(200);
    }
  });
});

describe('CORS', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  async function preflight(method: string) {
    return harness.app.inject({
      method: 'OPTIONS',
      url: '/users/me',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': method,
        'access-control-request-headers': 'authorization,content-type',
      },
    });
  }

  it('lets the browser preflight a write, not just a read', async () => {
    /*
     * @fastify/cors defaults to GET, HEAD, and POST. Leaving that default in
     * place made `PUT /users/me` unreachable from the frontend even though the
     * route worked — `app.inject()` bypasses CORS, so only a browser saw it.
     */
    const response = await preflight('PUT');
    const allowed = String(response.headers['access-control-allow-methods'] ?? '')
      .split(',')
      .map((method) => method.trim());

    expect(response.statusCode).toBe(204);
    expect(allowed).toContain('PUT');
    expect(allowed).toContain('DELETE');
    expect(allowed).toContain('PATCH');
  });

  it('echoes the configured origin and allows credentials', async () => {
    const response = await preflight('GET');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not hand an allow-origin header to an unlisted origin', async () => {
    const response = await harness.app.inject({
      method: 'OPTIONS',
      url: '/users/me',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'PUT',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('log redaction', () => {
  const captured: string[] = [];
  let harness: TestHarness;

  const collector = new Writable({
    write(chunk, _encoding, callback) {
      captured.push(String(chunk));
      callback();
    },
  });

  beforeAll(async () => {
    harness = await createTestHarness({
      env: { LOG_LEVEL: 'trace' },
      loggerStream: collector,
    });
    harness.clerkUsers.set('user_logged', {
      clerkUserId: 'user_logged',
      email: 'logged@example.com',
      firstName: 'Log',
      lastName: 'Redaction',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('never writes a session token to the log stream', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer('user_logged'),
    });
    expect(response.statusCode).toBe(200);

    /*
     * Fastify's default request serializer emits method, url, and hostname —
     * not headers — so the token has two independent reasons not to appear.
     * The `redact` paths in the server factory are the backstop for the day
     * someone adds a serializer that does include them.
     */
    const logs = captured.join('');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).not.toContain('token-user_logged');
  });

  it('never writes a rejected token to the log stream', async () => {
    captured.length = 0;

    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: 'Bearer super-secret-but-invalid' },
    });
    expect(response.statusCode).toBe(401);

    expect(captured.join('')).not.toContain('super-secret-but-invalid');
  });

  it('never writes a webhook signature to the log stream', async () => {
    captured.length = 0;

    await harness.app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: { ...SVIX_HEADERS, 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'session.created', data: { id: 'sess_1' } }),
    });

    expect(captured.join('')).not.toContain('valid-signature');
  });
});
