import { conversations, messages } from '@vendor-marketplace/db';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertMessage } from './messaging.dao.js';

/**
 * #399 — the message and the `last_message_at` bump that did not commit
 * together.
 *
 * `insertMessage` wrote the row and then updated the conversation as two
 * separate statements. A failure between them left the message stored and the
 * conversation's timestamp stale, so the thread did not rise to the top of
 * either party's `/messages` list and the recipient's preview lagged until
 * another message happened to land. It also broke the repository's own rule
 * that a multi-statement mutation runs in one transaction.
 *
 * **This one does not need two connections.** The other half of #399 — two
 * accepts racing for a date — cannot be proved here, because PGlite holds a
 * single connection and never overlaps two transactions. Atomicity is a
 * different property: it is about what survives a failure *inside* one caller,
 * so making the second statement fail proves it directly. A trigger is how the
 * second statement is made to fail without reaching into the function.
 */
const CUSTOMER = '00000000-0000-4000-8000-000000000001';
const VENDOR_USER = '00000000-0000-4000-8000-000000000002';
const VENDOR = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await database.runMigrations();

  await database.client.exec(`
    insert into users (id, clerk_user_id, email, first_name, last_name, role) values
      ('${CUSTOMER}', 'user_msg_customer', 'msg-customer@example.com', 'Ada', 'Byron', 'customer'),
      ('${VENDOR_USER}', 'user_msg_vendor', 'msg-vendor@example.com', 'Wren', 'Field', 'vendor');
    insert into vendor_profiles (id, user_id, business_name, slug)
      values ('${VENDOR}', '${VENDOR_USER}', 'Wren & Field', 'wren-field-msg');
    insert into booking_requests (id, customer_id, vendor_id, event_date, status)
      values ('${REQUEST}', '${CUSTOMER}', '${VENDOR}', '2027-06-14', 'pending');
    insert into conversations (id, customer_id, vendor_id, booking_request_id)
      values ('${CONVERSATION}', '${CUSTOMER}', '${VENDOR}', '${REQUEST}');

    create function refuse_conversation_update() returns trigger as $$
      begin raise exception 'conversation update refused'; end;
    $$ language plpgsql;
  `);
});

/**
 * A deliberately non-null starting value.
 *
 * Resetting to `null` made the rollback assertion unfalsifiable: the trigger
 * refuses every update, so `last_message_at` could only have stayed `null`
 * whatever the code did, and that half of "neither applied" passed against the
 * unfixed implementation too. Starting from a known timestamp means the
 * assertion is that it is *unchanged*, which the code can fail.
 *
 * In the past, not the future: the bump is monotonic, so a starting value ahead
 * of the message's own `created_at` would be left alone on purpose and every
 * "it moved" assertion would fail for the right reason at the wrong time.
 */
const EARLIER = new Date('2020-01-01T09:00:00.000Z');

beforeEach(async () => {
  await database.db.delete(messages);
  await database.client.exec('drop trigger if exists refuse_bump on conversations;');
  await database.db
    .update(conversations)
    .set({ lastMessageAt: EARLIER })
    .where(eq(conversations.id, CONVERSATION));
});

afterAll(async () => {
  await database.close();
});

async function send(body: string): Promise<void> {
  await insertMessage(database.db, {
    conversationId: CONVERSATION,
    senderId: CUSTOMER,
    content: body,
  });
}

async function storedMessages(): Promise<string[]> {
  const rows = await database.db
    .select({ content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, CONVERSATION));

  return rows.map((row) => row.content);
}

async function lastMessageAt(): Promise<Date | null> {
  const rows = await database.db
    .select({ at: conversations.lastMessageAt })
    .from(conversations)
    .where(eq(conversations.id, CONVERSATION));

  return rows[0]?.at ?? null;
}

/** Makes the second of the two statements fail, and only the second. */
async function refuseTheBump(): Promise<void> {
  await database.client.exec(`
    create trigger refuse_bump before update on conversations
      for each row execute function refuse_conversation_update();
  `);
}

describe('a message and the timestamp that orders its thread', () => {
  it('writes both when nothing fails', async () => {
    await send('Are you free that weekend?');

    expect(await storedMessages()).toEqual(['Are you free that weekend?']);
    expect(await lastMessageAt()).not.toEqual(EARLIER);
  });

  it('stamps the conversation with the message own time, not a second clock', async () => {
    await send('Are you free that weekend?');

    const rows = await database.db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, CONVERSATION));

    expect((await lastMessageAt())?.toISOString()).toBe(rows[0]?.createdAt.toISOString());
  });

  /*
   * The bump only ever moves forward. Two sends serialise on the conversation
   * row, and without the predicate the later-starting transaction can write the
   * *earlier* message's timestamp — walking a thread's ordering key backwards
   * and dropping it down both parties' lists a message after it should have
   * risen.
   */
  it('never moves the ordering key backwards', async () => {
    await send('first');
    const afterFirst = await lastMessageAt();

    await database.db
      .update(conversations)
      .set({ lastMessageAt: new Date('2099-01-01T00:00:00.000Z') })
      .where(eq(conversations.id, CONVERSATION));

    await send('second');

    expect(await storedMessages()).toEqual(['first', 'second']);
    expect(afterFirst).not.toBeNull();
    // A later stamp already stands, so this message must not pull it back.
    expect((await lastMessageAt())?.toISOString()).toBe('2099-01-01T00:00:00.000Z');
  });

  /*
   * The defect, stated as a test: before the transaction, the message survived
   * a failed bump. The thread then held a message neither party's list would
   * surface — invisible until some later message happened to update the same
   * row.
   */
  it('keeps neither when the bump fails', async () => {
    await refuseTheBump();

    await expect(send('Are you free that weekend?')).rejects.toThrow();

    expect(await storedMessages()).toEqual([]);
    expect(await lastMessageAt()).toEqual(EARLIER);
  });

  it('still writes both once the failure clears', async () => {
    await refuseTheBump();
    await expect(send('first')).rejects.toThrow();

    await database.client.exec('drop trigger refuse_bump on conversations;');
    await send('second');

    expect(await storedMessages()).toEqual(['second']);
    expect(await lastMessageAt()).not.toEqual(EARLIER);
  });
});
