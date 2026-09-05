import { eq } from 'drizzle-orm';
import { users } from '@vendor-marketplace/db/schema';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  SVIX_HEADERS,
  bearer,
  createTestHarness,
  type TestHarness,
} from '../../testing/test-server.js';

const CLERK_ID = 'user_webhook';

function userCreated(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'user.created',
    data: {
      id: CLERK_ID,
      email_addresses: [
        { id: 'idn_secondary', email_address: 'old@example.com' },
        { id: 'idn_primary', email_address: 'katherine@example.com' },
      ],
      primary_email_address_id: 'idn_primary',
      first_name: 'Katherine',
      last_name: 'Johnson',
      image_url: 'https://images.example.com/katherine.png',
      unsafe_metadata: { role: 'vendor' },
      ...overrides,
    },
  });
}

async function post(harness: TestHarness, payload: string, signature = 'valid-signature') {
  return harness.app.inject({
    method: 'POST',
    url: '/webhooks/clerk',
    headers: { ...SVIX_HEADERS, 'svix-signature': signature, 'content-type': 'application/json' },
    payload,
  });
}

describe('POST /webhooks/clerk', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('rejects a payload whose signature does not verify', async () => {
    const response = await post(harness, userCreated(), 'forged-signature');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ statusCode: 401, error: 'UNAUTHORIZED' });

    const rows = await harness.database.db.select().from(users);
    expect(rows).toHaveLength(0);
  });

  it('rejects a payload with no svix headers at all', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: { 'content-type': 'application/json' },
      payload: userCreated(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('creates the local user from user.created, using the primary email', async () => {
    const response = await post(harness, userCreated());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'created' });

    const rows = await harness.database.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, CLERK_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'katherine@example.com',
      firstName: 'Katherine',
      lastName: 'Johnson',
      role: 'vendor',
      deletedAt: null,
    });
  });

  it('is idempotent when Clerk redelivers user.created', async () => {
    await post(harness, userCreated());
    const second = await post(harness, userCreated());

    expect(second.statusCode).toBe(200);

    const rows = await harness.database.db.select().from(users);
    expect(rows).toHaveLength(1);
  });

  it('does not let user.created escalate the role through unsafe metadata', async () => {
    await post(harness, userCreated({ unsafe_metadata: { role: 'admin' } }));

    const rows = await harness.database.db.select().from(users);
    expect(rows[0]?.role).toBe('customer');
  });

  it('mirrors contact details from user.updated but leaves the role alone', async () => {
    await post(harness, userCreated());

    const response = await post(
      harness,
      JSON.stringify({
        type: 'user.updated',
        data: {
          id: CLERK_ID,
          email_addresses: [{ id: 'idn_primary', email_address: 'kj@example.com' }],
          primary_email_address_id: 'idn_primary',
          first_name: 'Kat',
          last_name: 'Johnson',
          image_url: '',
          unsafe_metadata: { role: 'admin' },
        },
      }),
    );

    expect(response.json()).toEqual({ received: true, outcome: 'updated' });

    const rows = await harness.database.db.select().from(users);
    expect(rows[0]).toMatchObject({
      email: 'kj@example.com',
      firstName: 'Kat',
      avatarUrl: null,
      role: 'vendor',
    });
  });

  /*
   * #398. Clerk owns the name and the account holder types it, so it is
   * untrusted free text on a path that never meets a request-body schema —
   * which is how it survived that ticket's first pass. It reaches the public
   * vendor page through `reviewerName` and both inboxes through
   * `otherPartyName`, so a bidi override in a first name reorders the sentence
   * around it for strangers.
   */
  it('strips bidi controls from a name Clerk hands it, on create', async () => {
    await post(harness, userCreated({ first_name: 'Kat\u202Eherine', last_name: 'John\u202Dson' }));

    const rows = await harness.database.db.select().from(users);

    expect(rows[0]?.firstName).toBe('Katherine');
    expect(rows[0]?.lastName).toBe('Johnson');
  });

  /*
   * And on update, which does not pass through `syncUserFromClerk`: a control
   * stripped at sign-up would otherwise come straight back the next time the
   * account holder edited their Clerk profile.
   */
  it('strips bidi controls from a name Clerk hands it, on update', async () => {
    await post(harness, userCreated());

    await post(
      harness,
      JSON.stringify({
        type: 'user.updated',
        data: {
          id: CLERK_ID,
          email_addresses: [{ id: 'idn_primary', email_address: 'kj@example.com' }],
          primary_email_address_id: 'idn_primary',
          first_name: '\u202EtaK',
          last_name: 'John\u2066son',
        },
      }),
    );

    const rows = await harness.database.db.select().from(users);

    expect(rows[0]?.firstName).toBe('taK');
    expect(rows[0]?.lastName).toBe('Johnson');
  });

  it('retires the row on user.deleted instead of removing it', async () => {
    await post(harness, userCreated());

    const response = await post(
      harness,
      JSON.stringify({ type: 'user.deleted', data: { id: CLERK_ID, deleted: true } }),
    );

    expect(response.json()).toEqual({ received: true, outcome: 'deleted' });

    const rows = await harness.database.db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it('stops resolving a session once the identity is deleted', async () => {
    harness.clerkUsers.set(CLERK_ID, {
      clerkUserId: CLERK_ID,
      email: 'katherine@example.com',
      firstName: 'Katherine',
      lastName: 'Johnson',
      roleHint: 'vendor',
      avatarUrl: null,
    });
    await post(harness, userCreated());
    await post(
      harness,
      JSON.stringify({ type: 'user.deleted', data: { id: CLERK_ID, deleted: true } }),
    );

    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(CLERK_ID),
    });

    expect(response.statusCode).toBe(401);

    // The retired row is left in place for bookings and reviews to reference.
    const rows = await harness.database.db.select().from(users);
    expect(rows).toHaveLength(1);
  });

  it('acknowledges an event type it does not handle without touching the table', async () => {
    const response = await post(
      harness,
      JSON.stringify({ type: 'session.created', data: { id: 'sess_1' } }),
    );

    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });

    const rows = await harness.database.db.select().from(users);
    expect(rows).toHaveLength(0);
  });

  it('rejects a body that is not valid JSON', async () => {
    const response = await post(harness, 'not-json-at-all');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
  });

  it('rejects an event that is missing the user id', async () => {
    const response = await post(harness, JSON.stringify({ type: 'user.created', data: {} }));

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('VALIDATION_ERROR');
  });
});
