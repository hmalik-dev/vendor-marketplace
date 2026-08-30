import { describe, expect, it } from 'vitest';
import { StreamTicketStore, STREAM_TICKET_TTL_MS } from './stream-tickets.js';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

/** A store whose clock the test drives, so expiry is asserted without waiting. */
function storeAt(start: number): { store: StreamTicketStore; advance: (ms: number) => void } {
  let now = start;
  const store = new StreamTicketStore({ now: () => now });

  return { store, advance: (ms) => (now += ms) };
}

describe('StreamTicketStore', () => {
  it('exchanges a ticket for the user it was issued to', () => {
    const { store } = storeAt(0);

    const { ticket } = store.issue(USER);

    expect(store.consume(ticket)).toBe(USER);
  });

  /*
   * #215's whole point. A stream URL still ends up in access logs, browser
   * history and `Referer`; what changes is that the value found there buys
   * nothing, because it is already spent.
   */
  it('refuses a ticket that has already been used', () => {
    const { store } = storeAt(0);
    const { ticket } = store.issue(USER);

    expect(store.consume(ticket)).toBe(USER);
    expect(store.consume(ticket)).toBeNull();
  });

  it('refuses a ticket once it has expired', () => {
    const { store, advance } = storeAt(0);
    const { ticket } = store.issue(USER);

    advance(STREAM_TICKET_TTL_MS + 1);

    expect(store.consume(ticket)).toBeNull();
  });

  it('still accepts a ticket one tick before it expires', () => {
    const { store, advance } = storeAt(0);
    const { ticket } = store.issue(USER);

    advance(STREAM_TICKET_TTL_MS - 1);

    expect(store.consume(ticket)).toBe(USER);
  });

  it('refuses a value that was never issued', () => {
    const { store } = storeAt(0);

    expect(store.consume('not-a-ticket')).toBeNull();
  });

  it('keeps two users’ tickets distinct', () => {
    const { store } = storeAt(0);

    const mine = store.issue(USER);
    const theirs = store.issue(OTHER);

    expect(store.consume(mine.ticket)).toBe(USER);
    expect(store.consume(theirs.ticket)).toBe(OTHER);
  });

  it('never issues the same ticket twice', () => {
    const { store } = storeAt(0);

    const issued = new Set(Array.from({ length: 200 }, () => store.issue(USER).ticket));

    expect(issued.size).toBe(200);
  });

  /*
   * The value is a bearer credential for the length of its life, so it needs
   * enough entropy that guessing one is not a strategy. 32 random bytes in
   * base64url is 43 characters.
   */
  it('issues an unguessable, URL-safe value', () => {
    const { store } = storeAt(0);

    const { ticket } = store.issue(USER);

    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(encodeURIComponent(ticket)).toBe(ticket);
  });

  /*
   * The expiry is enforced, not published. No client reads a deadline — the
   * browser connects immediately and re-exchanges on every reconnect — so the
   * property worth pinning is that the store stops accepting the ticket, not
   * that it announces when it will.
   */
  it('stops accepting a ticket once its window has passed', () => {
    const { store, advance } = storeAt(1_000);

    const { ticket } = store.issue(USER);
    advance(STREAM_TICKET_TTL_MS + 1);

    expect(store.consume(ticket)).toBeNull();
  });

  it('still accepts one a millisecond inside the window', () => {
    const { store, advance } = storeAt(1_000);

    const { ticket } = store.issue(USER);
    advance(STREAM_TICKET_TTL_MS - 1);

    expect(store.consume(ticket)).toBe(USER);
  });

  /** Minutes, per the ticket — long enough to connect, short enough to matter. */
  it('expires in minutes rather than hours', () => {
    expect(STREAM_TICKET_TTL_MS).toBeLessThanOrEqual(5 * 60_000);
    expect(STREAM_TICKET_TTL_MS).toBeGreaterThanOrEqual(30_000);
  });

  /*
   * Every authenticated page load issues one, and an unconsumed ticket has no
   * other reason to be dropped — without the sweep the store is a slow leak
   * for the lifetime of the process.
   */
  it('drops expired tickets rather than holding them forever', () => {
    const { store, advance } = storeAt(0);

    for (let index = 0; index < 50; index += 1) {
      store.issue(USER);
    }
    expect(store.size).toBe(50);

    advance(STREAM_TICKET_TTL_MS + 1);
    store.issue(OTHER);

    expect(store.size).toBe(1);
  });

  /*
   * A store that kept the raw value would put a live credential in a heap
   * dump; the hash is enough to check one that is presented.
   */
  it('does not retain the issued value', () => {
    const { store } = storeAt(0);

    const { ticket } = store.issue(USER);

    expect(JSON.stringify([...store.entries()])).not.toContain(ticket);
  });
});
