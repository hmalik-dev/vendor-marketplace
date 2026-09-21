import {
  conversations,
  messages,
  users,
  vendorProfiles,
  withRequestIdentity,
} from '@vendor-marketplace/db';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { identityOf } from '../../lib/database.js';
import { findExportMessages } from '../admin/data-rights.dao.js';
import type { AuthenticatedUser } from '../../plugins/neon-auth.js';
import { findMessages, insertMessage } from './messaging.dao.js';
import { listConversations, listMessages, readConversation } from './messaging.service.js';

/**
 * VEN-505 — the messaging request path, connected as the role the API will
 * run as, on a real Postgres.
 *
 * Two halves. The service functions must still work for the people in a thread
 * when every connection is `app_api` (the existing route suites run as the
 * table owner, which bypasses row-level security, so they cannot say so). And
 * the backstop must hold when the API-level ownership check is *not* there: the
 * DAO calls below are what `requireParticipant` guards, made without it.
 */
let owner: PostgresTestDatabase;
let api: ReturnType<PostgresTestDatabase['connectAs']>;

let customer: AuthenticatedUser;
let vendor: AuthenticatedUser;
let stranger: AuthenticatedUser;
let conversationId: string;

async function makeUser(label: string, role: 'customer' | 'vendor'): Promise<AuthenticatedUser> {
  const [row] = await owner.db
    .insert(users)
    .values({
      authUserId: `user_msg_rls_${label}`,
      email: `${label}@example.com`,
      role,
      firstName: label,
      lastName: 'Rls',
    })
    .returning({ id: users.id });

  return { id: row!.id, authUserId: `user_msg_rls_${label}`, role };
}

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 2 });
  customer = await makeUser('customer', 'customer');
  vendor = await makeUser('vendor', 'vendor');
  stranger = await makeUser('stranger', 'customer');

  const [profile] = await owner.db
    .insert(vendorProfiles)
    .values({ userId: vendor.id, businessName: 'Wren & Field', slug: 'wren-field-rls' })
    .returning({ id: vendorProfiles.id });
  const [thread] = await owner.db
    .insert(conversations)
    .values({ customerId: customer.id, vendorId: profile!.id })
    .returning({ id: conversations.id });
  conversationId = thread!.id;

  // Separate statements: one statement gives both rows one `created_at`, and the order is then the id's.
  await owner.db
    .insert(messages)
    .values({ conversationId, senderId: customer.id, content: 'Are you free on the 14th?' });
  await owner.db.insert(messages).values({ conversationId, senderId: vendor.id, content: 'I am.' });

  api = owner.connectAs('app_api');
}, 90_000);

afterAll(async () => {
  await owner?.close();
});

describe('the messaging service as app_api', () => {
  it('lists the thread, with its preview and unread count, for a participant', async () => {
    const list = await listConversations(api, customer);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: conversationId,
      lastMessagePreview: 'I am.',
      unreadCount: 1,
    });
  });

  it('reads the messages of a thread the caller is in', async () => {
    const page = await listMessages(api, vendor, conversationId, 1, 50);

    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.content)).toEqual(['Are you free on the 14th?', 'I am.']);
  });

  it('marks the counterparty messages read', async () => {
    await readConversation(api, customer, conversationId);

    const [list] = await listConversations(api, customer);

    expect(list?.unreadCount).toBe(0);
  });

  it('refuses a stranger at the service, as before', async () => {
    await expect(listMessages(api, stranger, conversationId, 1, 50)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('with the API ownership check taken away', () => {
  it('still returns nothing to a non-participant', async () => {
    const rows = await withRequestIdentity(api, identityOf(stranger), (tx) =>
      findMessages(tx, conversationId, 50, 0),
    );

    expect(rows).toEqual([]);
  });

  it('still refuses a non-participant an insert', async () => {
    await expect(
      withRequestIdentity(api, identityOf(stranger), (tx) =>
        insertMessage(tx, { conversationId, senderId: stranger.id, content: 'let me in' }),
      ),
    ).rejects.toThrow();
  });

  it('gives the operator export path the thread, and an admin on a participant path nothing', async () => {
    const asOperator = await withRequestIdentity(
      api,
      { userId: stranger.id, role: 'admin', operator: true },
      (tx) => findExportMessages(tx, customer.id, null),
    );
    const asParticipantPath = await withRequestIdentity(
      api,
      { userId: stranger.id, role: 'admin' },
      (tx) => findExportMessages(tx, customer.id, null),
    );

    expect(asOperator.map((row) => row.content)).toEqual(['Are you free on the 14th?', 'I am.']);
    expect(asParticipantPath).toEqual([]);
  });

  it('returns nothing at all when no identity was set', async () => {
    const rows = await findMessages(api, conversationId, 50, 0);

    expect(rows).toEqual([]);
  });
});
