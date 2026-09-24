import {
  conversations,
  messages,
  notifications,
  users,
  vendorProfiles,
  withRequestIdentity,
} from '@vendor-marketplace/db';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventHub } from '../../lib/event-stream.js';
import { identityOf, type AppDatabase } from '../../lib/database.js';
import type { AuthenticatedUser } from '../../plugins/neon-auth.js';
import { insertMessageReportingBacklog } from './messaging.dao.js';
import { sendMessage } from './messaging.service.js';

/**
 * VEN-527, VEN-726 — two messages sent at once still notify the recipient once.
 *
 * The sends lock the conversation row and count what is waiting under that
 * lock, so the second sees the first. An ordered check (`created_at`, `id`) is
 * not enough: `created_at` is the transaction's start, so the send that starts
 * first can commit second, see nothing ahead of it, and both notify.
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

async function sendersWaitingOnALock(): Promise<number> {
  // postgres-js hands back the rows themselves, not a `{ rows }` wrapper.
  const rows = await owner.db.execute<{ total: number }>(
    sql`select count(*)::int as total from pg_locks where not granted and locktype = 'transactionid'`,
  );

  return rows[0]?.total ?? 0;
}

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 4 });
  customer = await makeUser('customer', 'customer');
  api = owner.connectAs('app_api');
}, 90_000);

afterAll(async () => {
  await owner?.close();
});

describe('the backlog counted when a message is stored', () => {
  it('holds a second send behind the first, which then counts as waiting', async () => {
    const thread = await makeThread('forced-interleaving');
    const otherTab = owner.connectAs('app_api');
    const store = (db: AppDatabase, content: string) =>
      insertMessageReportingBacklog(
        db,
        { conversationId: thread.conversationId, senderId: customer.id, content },
        thread.vendor.id,
      );
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let stored!: () => void;
    const firstStored = new Promise<void>((resolve) => {
      stored = resolve;
    });

    // The first send has stored its message and not committed: its transaction stays open.
    const firstSend = owner.db.transaction(async (tx) => {
      const result = await store(tx, 'first');
      stored();
      await held;

      return result;
    });
    await firstStored;

    let secondDone = false;
    const secondSend = withRequestIdentity(otherTab, identityOf(customer), (tx) =>
      store(tx, 'second'),
    ).then((result) => {
      secondDone = true;

      return result;
    });

    try {
      // Until the second is queued on the first's row lock, or has finished without queueing.
      while (!secondDone && (await sendersWaitingOnALock()) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(secondDone).toBe(false);
    } finally {
      release();
    }

    const [firstResult, secondResult] = await Promise.all([firstSend, secondSend]);

    expect(firstResult.othersUnread).toBe(0);
    expect(secondResult.othersUnread).toBe(1);
  });

  it('counts only the sender’s unread messages besides its own', async () => {
    const thread = await makeThread('backlog-count');
    const send = (content: string) =>
      insertMessageReportingBacklog(
        owner.db,
        { conversationId: thread.conversationId, senderId: customer.id, content },
        thread.vendor.id,
      );

    expect((await send('one')).othersUnread).toBe(0);
    expect((await send('two')).othersUnread).toBe(1);
    expect((await send('three')).othersUnread).toBe(2);

    await owner.db
      .update(messages)
      .set({ readAt: sql`now()` })
      .where(eq(messages.conversationId, thread.conversationId));

    expect((await send('four')).othersUnread).toBe(0);
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
