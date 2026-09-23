import { users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

/*
 * VEN-549. On Railway the socket peer and the appended `X-Forwarded-For` entry
 * are the edge node, so the limiter bucketed per node: callers behind one node
 * shared 120 a minute and one caller got a bucket per node. The edge sets
 * `X-Real-IP` to the connecting client; the key reads that.
 */
describe('the rate-limit key behind Railway', () => {
  beforeEach(() => {
    vi.stubEnv('RAILWAY_ENVIRONMENT', 'staging');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** One edge node: the same socket and the same appended hop for every caller. */
  async function callAs(harness: TestHarness, headers: Record<string, string>): Promise<number> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/categories',
      headers: { 'x-forwarded-for': '10.250.0.7', ...headers },
    });
    return response.statusCode;
  }

  it('gives two client addresses behind one edge node their own buckets', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      await callAs(harness, { 'x-real-ip': '198.51.100.11' });
      await callAs(harness, { 'x-real-ip': '198.51.100.11' });

      expect(await callAs(harness, { 'x-real-ip': '198.51.100.11' })).toBe(429);
      expect(await callAs(harness, { 'x-real-ip': '198.51.100.12' })).toBe(200);
    } finally {
      await harness.close();
    }
  });

  it('does not let a forged x-forwarded-for mint a bucket', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      const real = { 'x-real-ip': '198.51.100.13' };
      await callAs(harness, { ...real, 'x-forwarded-for': '203.0.113.1, 10.250.0.7' });
      await callAs(harness, { ...real, 'x-forwarded-for': '203.0.113.2, 10.250.0.7' });

      const third = await callAs(harness, {
        ...real,
        'x-forwarded-for': '203.0.113.3, 10.250.0.7',
      });
      expect(third).toBe(429);
    } finally {
      await harness.close();
    }
  });

  it('falls back to the socket address for a malformed x-real-ip', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      await callAs(harness, { 'x-real-ip': 'not-an-address' });
      await callAs(harness, { 'x-real-ip': 'also-not-one' });

      expect(await callAs(harness, { 'x-real-ip': 'a-third' })).toBe(429);
    } finally {
      await harness.close();
    }
  });

  it('ignores x-real-ip when only NODE_ENV says deployed, where no edge sets it', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT', '');
    vi.stubEnv('NODE_ENV', 'production');
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      await callAs(harness, { 'x-real-ip': '198.51.100.14' });
      await callAs(harness, { 'x-real-ip': '198.51.100.15' });

      expect(await callAs(harness, { 'x-real-ip': '198.51.100.16' })).toBe(429);
    } finally {
      await harness.close();
    }
  });
});

/*
 * VEN-440. Behind the web platform every server-rendered call arrives from one
 * egress address, so `request.ip` cannot tell visitors apart. The web tier
 * names the visitor in a header and proves it is the web tier with a shared
 * key; a header on its own is one any caller could write.
 */
describe('the rate-limit key for the web tier', () => {
  const TIER_VALUE = 'k'.repeat(40);
  const tierEnv = { RATE_LIMIT_MAX: 2, WEB_TIER_KEY: TIER_VALUE };

  /** Every request shares one socket and sends no `x-forwarded-for`, as the web tier's fan-out does. */
  function callAs(
    harness: TestHarness,
    headers: Record<string, string>,
  ): Promise<{ statusCode: number }> {
    return harness.app.inject({ method: 'GET', url: '/categories', headers });
  }

  const asVisitor = (visitor: string, proof: string = TIER_VALUE): Record<string, string> => ({
    'x-visitor-ip': visitor,
    'x-web-tier-key': proof,
  });

  it('gives each forwarded visitor their own bucket', async () => {
    const harness = await createTestHarness({ env: tierEnv });

    try {
      for (const visitor of ['198.51.100.10', '198.51.100.11', '198.51.100.12']) {
        expect((await callAs(harness, asVisitor(visitor))).statusCode).toBe(200);
        expect((await callAs(harness, asVisitor(visitor))).statusCode).toBe(200);
      }
    } finally {
      await harness.close();
    }
  });

  it('still refuses one forwarded visitor past the limit', async () => {
    const harness = await createTestHarness({ env: tierEnv });

    try {
      await callAs(harness, asVisitor('198.51.100.20'));
      await callAs(harness, asVisitor('198.51.100.20'));

      expect((await callAs(harness, asVisitor('198.51.100.20'))).statusCode).toBe(429);
    } finally {
      await harness.close();
    }
  });

  it('ignores the forwarded visitor without the key, so it cannot mint buckets', async () => {
    const harness = await createTestHarness({ env: tierEnv });

    try {
      await callAs(harness, asVisitor('198.51.100.30', 'wrong'));
      await callAs(harness, asVisitor('198.51.100.31', 'wrong'));

      expect((await callAs(harness, asVisitor('198.51.100.32', 'wrong'))).statusCode).toBe(429);
      expect((await callAs(harness, { 'x-visitor-ip': '198.51.100.33' })).statusCode).toBe(429);
    } finally {
      await harness.close();
    }
  });

  /*
   * VEN-649: the warning was the only signal that every visitor now shares one
   * bucket. A key rotated on one side must reach the error tracker, at most
   * once an hour rather than once per request.
   */
  it('reports a wrong key to the error tracker at most once an hour', async () => {
    const captured: unknown[] = [];
    const harness = await createTestHarness({
      env: tierEnv,
      errorReporter: { capture: (error) => captured.push(error) },
    });

    try {
      await callAs(harness, asVisitor('198.51.100.50', 'wrong'));
      await callAs(harness, asVisitor('198.51.100.51', 'wrong'));
      await callAs(harness, asVisitor('198.51.100.52'));

      expect(captured).toHaveLength(1);
      expect((captured[0] as Error).message).toMatch(/^Web tier key mismatch:/);
    } finally {
      await harness.close();
    }
  });

  it('reports nothing when the key matches', async () => {
    const captured: unknown[] = [];
    const harness = await createTestHarness({
      env: tierEnv,
      errorReporter: { capture: (error) => captured.push(error) },
    });

    try {
      await callAs(harness, asVisitor('198.51.100.60'));

      expect(captured).toEqual([]);
    } finally {
      await harness.close();
    }
  });

  it('ignores the forwarded visitor when no key is configured', async () => {
    const harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });

    try {
      await callAs(harness, asVisitor('198.51.100.40', ''));
      await callAs(harness, asVisitor('198.51.100.41', ''));

      expect((await callAs(harness, asVisitor('198.51.100.42', ''))).statusCode).toBe(429);
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

describe('response hardening', () => {
  let harness: TestHarness;
  const AUTH_ID = 'user_hardening';

  beforeAll(async () => {
    harness = await createTestHarness();
    harness.authUsers.set(AUTH_ID, {
      authUserId: AUTH_ID,
      email: 'hardening@example.com',
      firstName: 'Hard',
      lastName: 'Ening',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  async function me() {
    return harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(AUTH_ID) });
  }

  it('gives a JSON response a CSP that allows nothing, since the API serves no documents', async () => {
    const response = await me();

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
  });

  it('does not return the Stripe customer id from GET /users/me, even when one is stored', async () => {
    await me();
    await harness.database.db
      .update(users)
      .set({ stripeCustomerId: 'cus_storedForHardening' })
      .where(eq(users.authUserId, AUTH_ID));

    const response = await me();

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty('stripeCustomerId');
    expect(response.body).not.toContain('cus_storedForHardening');
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
    harness.authUsers.set('user_logged', {
      authUserId: 'user_logged',
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
      url: '/webhooks/resend',
      headers: { ...SVIX_HEADERS, 'content-type': 'application/json' },
      payload: JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } }),
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
