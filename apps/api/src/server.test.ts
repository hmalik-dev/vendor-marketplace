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
      harness.app.inject({ method: 'GET', url: '/health', headers }),
      harness.app.inject({ method: 'GET', url: '/health', headers }),
    ]);
    expect(allowed.map((response) => response.statusCode)).toEqual([200, 200]);

    const blocked = await harness.app.inject({ method: 'GET', url: '/health', headers });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });
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
