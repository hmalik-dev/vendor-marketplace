import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

/*
 * #421. `request.ip` is the socket's remote address, so behind any load
 * balancer it is the *platform's* proxy — the same value for every visitor.
 * Every per-IP limit then shares one bucket: `RATE_LIMIT_MAX` becomes a
 * whole-deployment cap, and the support form's six-an-hour limit becomes six
 * messages an hour from everyone, on the one page that exists to report an
 * outage.
 *
 * It is invisible in ordinary local testing, because `pnpm dev` and
 * `app.inject()` both supply a real per-caller address — which is exactly why
 * this says which environment each case is asserting about.
 */
describe('the rate-limit key behind a proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Two callers, one bucket of two: the third request is refused iff they share a key. */
  async function sharesABucket(
    harness: TestHarness,
    forwarded: [string, string],
  ): Promise<boolean> {
    const get = (value: string): Promise<{ statusCode: number }> =>
      harness.app.inject({
        method: 'GET',
        url: '/categories',
        headers: { 'x-forwarded-for': value },
      });

    await get(forwarded[0]);
    await get(forwarded[0]);

    return (await get(forwarded[1])).statusCode === 429;
  }

  it('ignores the forwarding header on a laptop, where nothing sets it', async () => {
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      // Both callers are one socket, so the header buys them nothing — which
      // is right: trusting a header no proxy wrote would let a local request
      // name its own address.
      expect(await sharesABucket(harness, ['198.51.100.1', '198.51.100.2'])).toBe(true);
    } finally {
      await harness.close();
    }
  });

  it('keys on the address the proxy appended once deployed', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      expect(await sharesABucket(harness, ['198.51.100.3', '198.51.100.4'])).toBe(false);
    } finally {
      await harness.close();
    }
  });

  /*
   * The reason this is one hop and never `trustProxy: true`. `true` walks the
   * header to its **leftmost** entry, which the caller writes — so a limited
   * caller could mint a fresh bucket per request by prepending an address, and
   * the limiter would hand its key straight back to whoever it was limiting.
   */
  it('cannot be escaped by a caller who forges an earlier hop', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      const escaped = await sharesABucket(harness, [
        '198.51.100.5',
        // The proxy still appends the real address last; only the front of the
        // list is the caller's to write.
        '203.0.113.99, 198.51.100.5',
      ]);

      expect(escaped).toBe(true);
    } finally {
      await harness.close();
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

/*
 * Vercel's Fastify preset boots the API by importing `server.ts` and calling
 * its default export, and it refuses the deployment with "The default export
 * must be a function or server" when there is not one. That failure only ever
 * surfaces at runtime, in production, as a 500 on every route — the build
 * still succeeds — so the contract is asserted here instead.
 */
describe('the Vercel Fastify entrypoint', () => {
  it('default-exports a handler', async () => {
    const { default: handler } = await import('./server.js');

    expect(typeof handler).toBe('function');
  });

  it('takes the (req, res) pair the preset calls it with', async () => {
    // The preset invokes a default-exported function as a Node request
    // handler, not as a factory. A handler that ignored these and returned the
    // app instead would leave the response unwritten, which is not a crash —
    // every request simply hangs until the platform's 300s ceiling.
    const { default: handler } = await import('./server.js');

    expect(handler.length).toBe(2);
  });

  it('still exports the injectable builder the suites use', async () => {
    // The handler wires the real Postgres and S3 clients. It sits beside
    // `buildServer` rather than replacing it so the route suites can keep
    // injecting their own database, and so importing the module opens no pool.
    const module = await import('./server.js');

    expect(typeof module.buildServer).toBe('function');
  });
});
