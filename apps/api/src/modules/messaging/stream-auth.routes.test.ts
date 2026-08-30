import { users } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { readStreamTicket } from './messaging.routes.js';

const CUSTOMER = 'user_customer';

/** What a Clerk session token looks like to anything reading a URL. */
const JWT_SHAPED = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;

/** The harness resolves Clerk identities from this map rather than the network. */
function registerCustomer(harness: TestHarness): void {
  harness.clerkUsers.set(CUSTOMER, {
    clerkUserId: CUSTOMER,
    email: 'stream@example.com',
    firstName: 'Stream',
    lastName: 'Reader',
    roleHint: 'customer',
    avatarUrl: null,
  });
}

describe('readStreamTicket', () => {
  it('reads the ticket out of the stream URL', () => {
    expect(readStreamTicket('/events/stream?ticket=abc123')).toBe('abc123');
  });

  it('finds it beside other parameters', () => {
    expect(readStreamTicket('/events/stream?other=1&ticket=abc123')).toBe('abc123');
  });

  it.each([
    ['no query string', '/events/stream'],
    ['an empty query string', '/events/stream?'],
    ['a blank ticket', '/events/stream?ticket='],
    ['whitespace only', '/events/stream?ticket=%20%20'],
    ['some other parameter', '/events/stream?token=abc'],
  ])('reads nothing from %s', (_label, url) => {
    expect(readStreamTicket(url)).toBeNull();
  });
});

describe('the event stream authenticates with a ticket, not the session', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    registerCustomer(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function issueTicket(): Promise<string> {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });

    expect(response.statusCode).toBe(200);

    return response.json().ticket;
  }

  it('issues a ticket to an authenticated caller', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(typeof body.ticket).toBe('string');
    expect(body.ticket.length).toBeGreaterThan(20);
    // The ticket and nothing else: no expiry is published, because the client
    // connects immediately and re-exchanges on every reconnect.
    expect(Object.keys(body)).toEqual(['ticket']);
  });

  /** The ticket must not itself be a session token, or nothing has changed. */
  it('issues something that is not a JWT', async () => {
    const ticket = await issueTicket();

    expect(ticket).not.toMatch(JWT_SHAPED);
    expect(ticket).not.toContain('.');
  });

  it('refuses to issue one to an anonymous caller', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('UNAUTHORIZED');
  });

  /*
   * #215's regression guard, and the reason the auth plugin no longer reads a
   * query token: the API used to accept a session JWT in this URL, and its own
   * request logger then wrote 27 of them into one lane's dev log.
   */
  it('no longer accepts a session token in the URL', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/events/stream?token=${encodeURIComponent('token-' + CUSTOMER)}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a stream with no ticket at all', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/events/stream' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('UNAUTHORIZED');
  });

  it('refuses a ticket that was never issued', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/events/stream?ticket=not-a-real-ticket',
    });

    expect(response.statusCode).toBe(401);
  });

  /*
   * The property that makes a ticket in a logfile worthless. Required by the
   * ticket: "a stream ticket cannot be replayed after use".
   */
  it('refuses a ticket that has already opened a stream', async () => {
    const ticket = await issueTicket();

    const heldBefore = harness.app.streamTickets.size;

    // The stream never ends, so the connection is abandoned rather than
    // awaited — spending the ticket is what this asserts, not the body.
    void harness.app.inject({ method: 'GET', url: `/events/stream?ticket=${ticket}` });
    /*
     * Waits for the ticket to actually be spent rather than assuming it
     * happens within one macrotask. Any hook ahead of the handler that awaits
     * I/O would break that assumption, and the failure mode would be this test
     * hanging on a stream that never resolves instead of failing an assertion.
     */
    await vi.waitFor(() => expect(harness.app.streamTickets.size).toBe(heldBefore - 1));

    const replay = await harness.app.inject({
      method: 'GET',
      url: `/events/stream?ticket=${ticket}`,
    });

    expect(replay.statusCode).toBe(401);
  });

  it('issues a distinct ticket every time, so none is guessable from another', async () => {
    const first = await issueTicket();
    const second = await issueTicket();

    expect(first).not.toBe(second);
  });

  /*
   * The wiring the whole scheme depends on, and the one thing no other test
   * sees: the stream must subscribe **the user the ticket named**. Subscribing
   * any other id leaves every test green while every message silently fails to
   * arrive and the connection looks healthy.
   */
  it('subscribes the user the ticket named, not whoever connected', async () => {
    const subscribe = vi.spyOn(harness.app.events, 'subscribe');
    const ticket = await issueTicket();

    void harness.app.inject({ method: 'GET', url: `/events/stream?ticket=${ticket}` });
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));

    const [subscribedId] = subscribe.mock.calls[0] ?? [];
    const [row] = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER));

    expect(subscribedId).toBe(row?.id);
    subscribe.mockRestore();
  });

  /*
   * The stream no longer goes through `requireAuth`, which is what used to
   * refuse a suspended account. A ticket names a user and says nothing about
   * whether that user is still allowed in, so the route asks — otherwise a ban
   * landing between issue and connect would be ignored, and a stream once open
   * stays open.
   */
  it('refuses a valid ticket belonging to an account that has since been suspended', async () => {
    const ticket = await issueTicket();

    await harness.database.db
      .update(users)
      .set({ isBanned: true })
      .where(eq(users.clerkUserId, CUSTOMER));

    const response = await harness.app.inject({
      method: 'GET',
      url: `/events/stream?ticket=${ticket}`,
    });

    try {
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('FORBIDDEN');
    } finally {
      // Restored even when the assertion fails, so a failure here does not
      // leave the row banned for everything appended to this describe.
      await harness.database.db
        .update(users)
        .set({ isBanned: false })
        .where(eq(users.clerkUserId, CUSTOMER));
    }
  });
});

describe('no URL the API logs carries a credential', () => {
  const captured: string[] = [];
  let harness: TestHarness;

  const collector = new Writable({
    write(chunk, _encoding, callback) {
      captured.push(String(chunk));
      callback();
    },
  });

  beforeAll(async () => {
    harness = await createTestHarness({ env: { LOG_LEVEL: 'trace' }, loggerStream: collector });
    registerCustomer(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  afterEach(() => {
    captured.length = 0;
  });

  /*
   * Required by the ticket: "no request URL in an authenticated session
   * contains a JWT-shaped value". Driven through the routes an authenticated
   * page load actually makes, including the stream itself.
   */
  it('writes no JWT-shaped value for an authenticated session', async () => {
    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(CUSTOMER) });

    const issued = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(CUSTOMER),
    });
    expect(issued.statusCode).toBe(200);

    void harness.app.inject({
      method: 'GET',
      url: `/events/stream?ticket=${issued.json().ticket}`,
    });
    await new Promise((resolve) => setImmediate(resolve));

    const logs = captured.join('');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).not.toMatch(JWT_SHAPED);
  });

  /*
   * The guard that survives the next mistake: even if some future route puts
   * a credential back into a URL, the logger cannot write it.
   */
  it('redacts a query value even when a credential reaches a URL again', async () => {
    await harness.app.inject({
      method: 'GET',
      url: '/events/stream?token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4In0.signature',
    });

    const logs = captured.join('');
    expect(logs).toContain('/events/stream?token=[redacted]');
    expect(logs).not.toContain('eyJhbGci');
  });

  it('still logs the path and parameter names, so the log stays readable', async () => {
    await harness.app.inject({ method: 'GET', url: '/vendors?category=photography&city=Austin' });

    const logs = captured.join('');
    expect(logs).toContain('/vendors?category=[redacted]&city=[redacted]');
    expect(logs).not.toContain('photography');
  });
});
