import {
  conversations,
  messages,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventHub } from '../../lib/event-stream.js';
import type { AuthenticatedUser } from '../../plugins/neon-auth.js';
import { countEarlierUnreadInConversation } from './messaging.dao.js';
import { sendMessage } from './messaging.service.js';

/**
 * VEN-527 — two messages sent at once still notify the recipient once.
 *
 * Both sends commit before either counts what is ahead of it, so a check that
 * asks for "any other unread message" sees the other one from both sides and
 * both skip: no notification at all. The check is ordered instead.
 */
let owner: PostgresTestDatabase;
let api: ReturnType<PostgresTestDatabase['connectAs']>;
let customer: AuthenticatedUser;

const hub = new EventHub();
// sendMessage only calls `error`, and only when the bell fails; a failure there must fail the test.
const log = {
  error: (...args: unknown[]) => {
    throw new Error(`notification failed: ${JSON.stringify(args)}`);
  },
} as unknown as FastifyBaseLogger;

async function makeUser(label: string, role: 'customer' | 'vendor'): Promise<AuthenticatedUser> {
  const [row] = await owner.db
    .insert(users)
    .values({
      authUserId: `user_msg_notify_${label}`,
      email: `${label}@example.com`,
      role,
      firstName: label,
      lastName: 'Notify',
    })
    .returning({ id: users.id });

  return { id: row!.id, authUserId: `user_msg_notify_${label}`, role };
}

interface Thread {
  conversationId: string;
  vendor: AuthenticatedUser;
}

// A vendor user owns one profile and a customer one thread with it, so each test gets its own vendor.
async function makeThread(slug: string): Promise<Thread> {
  const vendor = await makeUser(slug, 'vendor');
  const [profile] = await owner.db
    .insert(vendorProfiles)
    .values({ userId: vendor.id, businessName: slug, slug, isPublished: true })
    .returning({ id: vendorProfiles.id });
  const [thread] = await owner.db
    .insert(conversations)
    .values({ customerId: customer.id, vendorId: profile!.id })
    .returning({ id: conversations.id });

  return { conversationId: thread!.id, vendor };
}

async function notificationsFor({ conversationId, vendor }: Thread): Promise<number> {
  const rows = await owner.db
    .select({ data: notifications.data })
    .from(notifications)
    .where(and(eq(notifications.userId, vendor.id), eq(notifications.type, 'new_message')));

  return rows.filter(
    (row) => (row.data as { conversationId?: string }).conversationId === conversationId,
  ).length;
}

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 4 });
  customer = await makeUser('customer', 'customer');
  api = owner.connectAs('app_api');
}, 90_000);

afterAll(async () => {
  await owner?.close();
});

describe('the unread check ahead of a message', () => {
  async function insertPair(
    thread: Thread,
    stamps: readonly [string, string],
  ): Promise<[string, string]> {
    const ids: string[] = [];

    for (const stamp of stamps) {
      // Raw timestamptz literals: a `Date` cannot carry the microseconds the column stores.
      const [row] = await owner.db
        .insert(messages)
        .values({
          conversationId: thread.conversationId,
          senderId: customer.id,
          content: stamp,
          createdAt: sql`${stamp}::timestamptz`,
        })
        .returning({ id: messages.id });
      ids.push(row!.id);
    }

    return [ids[0]!, ids[1]!];
  }

  it('sees nothing ahead of the earlier of two messages and the earlier one ahead of the later', async () => {
    const thread = await makeThread('ordered-check');
    const [first, second] = await insertPair(thread, [
      '2026-01-01 00:00:00.100000+00',
      '2026-01-01 00:00:00.200000+00',
    ]);
    const count = (id: string): Promise<number> =>
      countEarlierUnreadInConversation(owner.db, thread.conversationId, thread.vendor.id, id);

    expect(await count(first)).toBe(0);
    expect(await count(second)).toBe(1);
  });

  it('orders two messages sent in the same millisecond by their microseconds', async () => {
    const thread = await makeThread('same-millisecond');
    const [first, second] = await insertPair(thread, [
      '2026-01-01 00:00:00.001000+00',
      '2026-01-01 00:00:00.001500+00',
    ]);
    const count = (id: string): Promise<number> =>
      countEarlierUnreadInConversation(owner.db, thread.conversationId, thread.vendor.id, id);

    expect(await count(first)).toBe(0);
    expect(await count(second)).toBe(1);
  });

  it('breaks a created_at tie by id', async () => {
    const thread = await makeThread('tied-check');
    const rows = await owner.db
      .insert(messages)
      .values(
        ['a', 'b'].map((content) => ({
          conversationId: thread.conversationId,
          senderId: customer.id,
          content,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        })),
      )
      .returning({ id: messages.id });
    const [earlier, later] = rows.map((row) => row.id).sort();
    const count = (id: string): Promise<number> =>
      countEarlierUnreadInConversation(owner.db, thread.conversationId, thread.vendor.id, id);

    expect(await count(earlier!)).toBe(0);
    expect(await count(later!)).toBe(1);
  });
});

describe('sendMessage notifying the recipient', () => {
  it('raises exactly one notification for two sends fired in parallel', async () => {
    const thread = await makeThread('parallel-sends');
    // A `connectAs` handle holds one connection, so two calls through one would queue, not race.
    const otherTab = owner.connectAs('app_api');

    await Promise.all([
      sendMessage(api, hub, log, customer, thread.conversationId, 'Are you free?'),
      sendMessage(otherTab, hub, log, customer, thread.conversationId, 'Are you free?!'),
    ]);

    expect(await notificationsFor(thread)).toBe(1);
  });

  it('raises nothing further for a later message while earlier ones are unread', async () => {
    const thread = await makeThread('sequential-sends');

    const { conversationId } = thread;

    await sendMessage(api, hub, log, customer, conversationId, 'one');
    await sendMessage(api, hub, log, customer, conversationId, 'two');
    await sendMessage(api, hub, log, customer, conversationId, 'three');

    expect(await notificationsFor(thread)).toBe(1);
  });
});
