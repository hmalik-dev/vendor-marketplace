import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { streamTickets, users } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import {
  MAX_OUTSTANDING_TICKETS,
  StreamTicketStore,
  STREAM_TICKET_TTL_MS,
} from './stream-tickets.js';

let database: TestDatabase;
let USER: string;
let OTHER: string;

async function makeUser(authUserId: string): Promise<string> {
  const [row] = await database.db
    .insert(users)
    .values({
      authUserId,
      email: `${authUserId}@example.com`,
      role: 'customer',
      firstName: 'Ticket',
      lastName: 'Holder',
    })
    .returning({ id: users.id });

  return row!.id;
}

/** A store whose clock the test drives, so expiry is asserted without waiting. */
function storeAt(start: number): { store: StreamTicketStore; advance: (ms: number) => void } {
  let now = start;
  const store = new StreamTicketStore(database.db, { now: () => now });

  return { store, advance: (ms) => (now += ms) };
}

describe('StreamTicketStore', () => {
  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    USER = await makeUser('ticket_user');
    OTHER = await makeUser('ticket_other');
  });

  afterAll(async () => {
    await database.close();
  });

  it('exchanges a ticket for the user it was issued to', async () => {
    const { store } = storeAt(0);

    const { ticket } = await store.issue(USER);

    expect(await store.consume(ticket)).toBe(USER);
  });

  /*
   * #215's whole point. A stream URL still ends up in access logs, browser
   * history and `Referer`; what changes is that the value found there buys
   * nothing, because it is already spent.
   */
  it('refuses a ticket that has already been used', async () => {
    const { store } = storeAt(0);
    const { ticket } = await store.issue(USER);

    expect(await store.consume(ticket)).toBe(USER);
    expect(await store.consume(ticket)).toBeNull();
  });

  it('refuses a ticket once it has expired', async () => {
    const { store, advance } = storeAt(0);
    const { ticket } = await store.issue(USER);

    advance(STREAM_TICKET_TTL_MS + 1);

    expect(await store.consume(ticket)).toBeNull();
  });

  it('still accepts a ticket one tick before it expires', async () => {
    const { store, advance } = storeAt(0);
    const { ticket } = await store.issue(USER);

    advance(STREAM_TICKET_TTL_MS - 1);

    expect(await store.consume(ticket)).toBe(USER);
  });

  it('refuses a value that was never issued', async () => {
    const { store } = storeAt(0);

    expect(await store.consume('not-a-ticket')).toBeNull();
  });

  it('keeps two users’ tickets distinct', async () => {
    const { store } = storeAt(0);

    const mine = await store.issue(USER);
    const theirs = await store.issue(OTHER);

    expect(await store.consume(mine.ticket)).toBe(USER);
    expect(await store.consume(theirs.ticket)).toBe(OTHER);
  });

  it('never issues the same ticket twice', async () => {
    const { store } = storeAt(0);
    const issued = new Set<string>();

    for (let i = 0; i < MAX_OUTSTANDING_TICKETS; i += 1) {
      issued.add((await store.issue(OTHER)).ticket);
    }

    expect(issued.size).toBe(MAX_OUTSTANDING_TICKETS);
  });

  /*
   * The value is a bearer credential for the length of its life, so it needs
   * enough entropy that guessing one is not a strategy. 32 random bytes in
   * base64url is 43 characters.
   */
  it('issues an unguessable, URL-safe value', async () => {
    const { store } = storeAt(0);

    const { ticket } = await store.issue(USER);

    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(encodeURIComponent(ticket)).toBe(ticket);
  });

  /** Minutes, per the ticket — long enough to connect, short enough to matter. */
  it('expires in minutes rather than hours', () => {
    expect(STREAM_TICKET_TTL_MS).toBeLessThanOrEqual(5 * 60_000);
    expect(STREAM_TICKET_TTL_MS).toBeGreaterThanOrEqual(30_000);
  });

  /*
   * Every authenticated page load issues one, and an unconsumed ticket has no
   * other reason to be dropped — without the sweep the table is a slow leak.
   */
  it('drops expired tickets when swept, and does not count them against the cap', async () => {
    await database.db.delete(streamTickets);
    const { store, advance } = storeAt(0);

    for (let index = 0; index < 5; index += 1) {
      await store.issue(USER);
    }
    expect(await heldRows()).toBe(5);

    advance(STREAM_TICKET_TTL_MS + 1);
    await store.sweep();

    expect(await heldRows()).toBe(0);
  });

  /*
   * A store that kept the raw value would put a live credential in a database
   * dump; the hash is enough to check one that is presented.
   */
  it('does not retain the issued value', async () => {
    const { store } = storeAt(0);

    const { ticket } = await store.issue(USER);
    const rows = await database.db.select().from(streamTickets);

    expect(JSON.stringify(rows)).not.toContain(ticket);
  });

  it('refuses a user who already holds the ceiling of unspent tickets, and only that user', async () => {
    await database.db.delete(streamTickets);
    const { store } = storeAt(0);

    for (let i = 0; i < MAX_OUTSTANDING_TICKETS; i += 1) {
      await store.issue(USER);
    }

    await expect(store.issue(USER)).rejects.toMatchObject({ statusCode: 429 });
    await expect(store.issue(OTHER)).resolves.toHaveProperty('ticket');
  });

  it('frees the ceiling as tickets are spent', async () => {
    await database.db.delete(streamTickets);
    const { store } = storeAt(0);
    const first = await store.issue(USER);

    for (let i = 1; i < MAX_OUTSTANDING_TICKETS; i += 1) {
      await store.issue(USER);
    }
    expect(await store.consume(first.ticket)).toBe(USER);

    await expect(store.issue(USER)).resolves.toHaveProperty('ticket');
  });

  /** Two stores over one database are two API instances. */
  it('spends on a second store what the first issued, once', async () => {
    await database.db.delete(streamTickets);
    const { store: a } = storeAt(0);
    const { store: b } = storeAt(0);
    const { ticket } = await a.issue(USER);

    expect(await b.consume(ticket)).toBe(USER);
    expect(await a.consume(ticket)).toBeNull();
  });

  it('removes a user’s tickets with the user', async () => {
    const gone = await makeUser('ticket_gone');
    const { store } = storeAt(0);
    await store.issue(gone);

    await database.db.delete(users).where(eq(users.id, gone));

    const [held] = await database.db
      .select({ n: count() })
      .from(streamTickets)
      .where(eq(streamTickets.userId, gone));
    expect(held?.n).toBe(0);
  });
});

async function heldRows(): Promise<number> {
  const [row] = await database.db.select({ n: count() }).from(streamTickets);

  return row?.n ?? 0;
}
