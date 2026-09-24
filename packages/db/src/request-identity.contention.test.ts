import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from './load-env.js';
import { withRequestIdentity, type RequestIdentity } from './request-identity.js';
import type * as schema from './schema/index.js';
import { conversations, messages, users, vendorProfiles } from './schema/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from './testing/postgres-test-db.js';

loadEnv();

/**
 * Row-level security on `messages`, as the role the API will connect as.
 *
 * Every other suite runs as the table owner, which bypasses RLS, so none of them
 * can tell a policy from its absence. This one opens a pool whose connections
 * are `app_api` (a startup `role`, so each connection is bound the way a
 * deployed API's would be) and checks what that role can and cannot reach.
 */
let owner: PostgresTestDatabase;
let api: PostgresJsDatabase<typeof schema>;

interface Cast {
  customerA: RequestIdentity;
  customerB: RequestIdentity;
  vendorOne: RequestIdentity;
  vendorTwo: RequestIdentity;
  admin: RequestIdentity;
  strangerConversation: string;
  threadOne: string;
  ownMessage: string;
  vendorMessage: string;
  otherMessage: string;
}

let cast: Cast;

async function seed(): Promise<Cast> {
  const db = owner.db;
  const make = async (
    label: string,
    role: 'customer' | 'vendor' | 'admin',
  ): Promise<RequestIdentity> => {
    const [row] = await db
      .insert(users)
      .values({
        authUserId: `user_rls_${label}`,
        email: `${label}@example.com`,
        role,
        firstName: label,
        lastName: 'Rls',
      })
      .returning({ id: users.id });

    return { userId: row!.id, role };
  };

  const customerA = await make('customer-a', 'customer');
  const customerB = await make('customer-b', 'customer');
  const vendorOne = await make('vendor-one', 'vendor');
  const vendorTwo = await make('vendor-two', 'vendor');
  const admin = await make('admin', 'admin');

  const profile = async (identity: RequestIdentity, slug: string): Promise<string> => {
    const [row] = await db
      .insert(vendorProfiles)
      .values({ userId: identity.userId, businessName: slug, slug })
      .returning({ id: vendorProfiles.id });

    return row!.id;
  };

  const profileOne = await profile(vendorOne, 'rls-one');
  const profileTwo = await profile(vendorTwo, 'rls-two');

  const [threadOne] = await db
    .insert(conversations)
    .values({ customerId: customerA.userId, vendorId: profileOne })
    .returning({ id: conversations.id });
  const [threadTwo] = await db
    .insert(conversations)
    .values({ customerId: customerB.userId, vendorId: profileTwo })
    .returning({ id: conversations.id });

  const [own] = await db
    .insert(messages)
    .values({ conversationId: threadOne!.id, senderId: customerA.userId, content: 'a to one' })
    .returning({ id: messages.id });
  const [fromVendor] = await db
    .insert(messages)
    .values({ conversationId: threadOne!.id, senderId: vendorOne.userId, content: 'one to a' })
    .returning({ id: messages.id });
  const [other] = await db
    .insert(messages)
    .values({ conversationId: threadTwo!.id, senderId: customerB.userId, content: 'b to two' })
    .returning({ id: messages.id });

  return {
    customerA,
    customerB,
    vendorOne,
    vendorTwo,
    admin,
    strangerConversation: threadTwo!.id,
    threadOne: threadOne!.id,
    ownMessage: own!.id,
    vendorMessage: fromVendor!.id,
    otherMessage: other!.id,
  };
}

async function countAs(identity: RequestIdentity): Promise<number> {
  return withRequestIdentity(api, identity, async (tx) => {
    const [row] = await tx.select({ total: sql<number>`count(*)::int` }).from(messages);

    return row!.total;
  });
}

function markRead(identity: RequestIdentity, messageId: string): Promise<{ id: string }[]> {
  return withRequestIdentity(api, identity, (tx) =>
    tx
      .update(messages)
      .set({ readAt: new Date() })
      .where(sql`${messages.id} = ${messageId}`)
      .returning({ id: messages.id }),
  );
}

beforeAll(async () => {
  owner = await createPostgresTestDatabase({ poolSize: 2 });
  cast = await seed();

  // One connection, so back-to-back requests provably share it.
  api = owner.connectAs('app_api');
}, 90_000);

afterAll(async () => {
  await owner?.close();
});

describe('as app_api, reading messages', () => {
  it('is a role RLS binds', async () => {
    const [role] = await api.execute<{ bypass: boolean; superuser: boolean; user: string }>(sql`
      select r.rolbypassrls as bypass, r.rolsuper as superuser, current_user as user
        from pg_roles r where r.rolname = 'app_api'`);

    expect(role).toEqual({ bypass: false, superuser: false, user: 'app_api' });
  });

  it("returns exactly the caller's threads", async () => {
    expect(await countAs(cast.customerA)).toBe(2);
    expect(await countAs(cast.vendorOne)).toBe(2);
    expect(await countAs(cast.customerB)).toBe(1);
    expect(await countAs(cast.vendorTwo)).toBe(1);
  });

  it('returns nothing when no identity is set', async () => {
    const [row] = await api.execute<{ total: number }>(
      sql`select count(*)::int as total from messages`,
    );

    expect(row?.total).toBe(0);
  });

  it('lets an admin read every thread, keyed on the role and not the user', async () => {
    expect(await countAs({ ...cast.admin, admin: true })).toBe(3);
    expect(await countAs({ userId: cast.admin.userId, role: 'customer', admin: true })).toBe(0);
    // An admin account on a participant path is bound to its own threads.
    expect(await countAs(cast.admin)).toBe(0);
  });

  it('leaves tables without their own policy readable, so the switch changes nothing else', async () => {
    const [row] = await api.execute<{ total: number }>(
      sql`select count(*)::int as total from users`,
    );

    expect(row?.total).toBe(5);
  });
});

describe('as app_api, writing messages', () => {
  it("refuses an update to another thread's message", async () => {
    expect(await markRead(cast.customerA, cast.otherMessage)).toEqual([]);
  });

  it('lets the counterparty mark a message read, and not the sender their own', async () => {
    expect(await markRead(cast.customerA, cast.ownMessage)).toEqual([]);
    expect(await markRead(cast.customerA, cast.vendorMessage)).toEqual([
      { id: cast.vendorMessage },
    ]);
  });

  it('refuses to rewrite what was said', async () => {
    await expect(
      withRequestIdentity(api, cast.customerA, (tx) =>
        tx
          .update(messages)
          .set({ content: 'edited' })
          .where(sql`${messages.id} = ${cast.vendorMessage}`),
      ),
    ).rejects.toThrow();
  });

  it('refuses an insert into a thread the caller is not in', async () => {
    await expect(
      withRequestIdentity(api, cast.customerA, (tx) =>
        tx.insert(messages).values({
          conversationId: cast.strangerConversation,
          senderId: cast.customerA.userId,
          content: 'intrusion',
        }),
      ),
    ).rejects.toThrow();
  });

  it('refuses an insert that names someone else as the sender', async () => {
    await expect(
      withRequestIdentity(api, cast.customerA, (tx) =>
        tx.insert(messages).values({
          conversationId: cast.threadOne,
          senderId: cast.vendorOne.userId,
          content: 'forged',
        }),
      ),
    ).rejects.toThrow();
  });

  it('refuses an admin write and any delete', async () => {
    await expect(
      withRequestIdentity(api, cast.admin, (tx) =>
        tx.insert(messages).values({
          conversationId: cast.threadOne,
          senderId: cast.admin.userId,
          content: 'from the platform',
        }),
      ),
    ).rejects.toThrow();

    const deleted = await withRequestIdentity(api, cast.customerA, (tx) =>
      tx.delete(messages).returning({ id: messages.id }),
    );

    expect(deleted).toEqual([]);
  });

  it('accepts a participant sending their own message', async () => {
    const [inserted] = await withRequestIdentity(api, cast.vendorOne, (tx) =>
      tx
        .insert(messages)
        .values({ conversationId: cast.threadOne, senderId: cast.vendorOne.userId, content: 'ok' })
        .returning({ content: messages.content }),
    );

    expect(inserted).toEqual({ content: 'ok' });
  });
});

describe('the identity on a shared connection', () => {
  async function userIdSeenBy(identity: RequestIdentity): Promise<string | undefined> {
    return withRequestIdentity(api, identity, async (tx) => {
      // The transaction type is driver-agnostic, so its rows come back `unknown`; postgres-js returns an array.
      const rows = (await tx.execute(sql`select app_user_id() as id`)) as unknown as {
        id: string;
      }[];

      return rows[0]?.id;
    });
  }

  it('does not leak from one request to the next', async () => {
    const first = await userIdSeenBy(cast.customerA);
    const second = await userIdSeenBy(cast.customerB);
    const [after] = await api.execute<{ user: string | null; role: string | null }>(sql`
      select nullif(current_setting('app.user_id', true), '') as user,
             nullif(current_setting('app.role', true), '') as role`);

    expect(first).toBe(cast.customerA.userId);
    expect(second).toBe(cast.customerB.userId);
    expect(after).toEqual({ user: null, role: null });
  });

  it('keeps two overlapping requests apart on the one connection', async () => {
    const alone = [await countAs(cast.customerA), await countAs(cast.customerB)];
    const overlapping = await Promise.all([countAs(cast.customerA), countAs(cast.customerB)]);

    expect(overlapping).toEqual(alone);
    expect(overlapping[0]).not.toBe(overlapping[1]);
  });

  it('does not outlive a nested call inside the caller’s own transaction', async () => {
    const seenAfter = await api.transaction(async (outer) => {
      await withRequestIdentity(outer, { ...cast.admin, admin: true }, async () => undefined);
      const [row] = await outer.execute<{ total: number }>(
        sql`select count(*)::int as total from messages`,
      );

      return row?.total;
    });

    expect(seenAfter).toBe(0);
  });

  it('rolls the identity back with a failed request', async () => {
    await expect(
      withRequestIdentity(api, cast.customerA, async () => {
        throw new Error('handler failed');
      }),
    ).rejects.toThrow('handler failed');

    expect(await countAs(cast.customerB)).toBe(1);
  });

  it.each([
    ['a malformed user id', { userId: "1'; drop table messages;--", role: 'customer' }],
    ['an unknown role', { userId: '00000000-0000-4000-8000-000000000001', role: 'root' }],
  ])('refuses %s before running anything', async (_label, identity) => {
    await expect(
      withRequestIdentity(api, identity as RequestIdentity, async () => 'ran'),
    ).rejects.toThrow(/Request identity/);
  });
});

describe('the policy set', () => {
  it('gives app_api a policy on every public table, so a new table is not silently unreachable', async () => {
    const rows = await owner.db.execute<{ name: string }>(sql`
      select c.relname as name
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (
           select 1 from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname and 'app_api' = any(p.roles))`);

    expect([...rows]).toEqual([]);
  });

  it('forces RLS on messages and only messages', async () => {
    const rows = await owner.db.execute<{ name: string }>(sql`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relforcerowsecurity`);

    expect([...rows]).toEqual([{ name: 'messages' }]);
  });
});
