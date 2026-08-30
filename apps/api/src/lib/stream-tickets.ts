import { createHash, randomBytes } from 'node:crypto';

/**
 * How long an unused stream ticket stays valid.
 *
 * The client exchanges one and connects immediately, so this only has to cover
 * a slow round trip — and #215 asks for minutes, not hours, because the value
 * still lands in access logs, browser history and `Referer` on its way to the
 * stream. Short enough that a ticket recovered from a log is almost always
 * already dead, and single use makes the rest of the window worthless too.
 */
export const STREAM_TICKET_TTL_MS = 60_000;

/** Bytes of randomness per ticket — 43 base64url characters. */
const TICKET_BYTES = 32;

export interface IssuedStreamTicket {
  /** The opaque value handed to the browser. Never stored. */
  readonly ticket: string;
  /** When it stops being accepted, so a client can refresh before it does. */
  readonly expiresAt: Date;
}

interface StoredTicket {
  readonly userId: string;
  readonly expiresAtMs: number;
}

export interface StreamTicketStoreOptions {
  /** Injectable clock; the suite drives expiry rather than waiting for it. */
  now?: () => number;
}

/**
 * Short-lived, single-use tickets that authenticate one `EventSource`.
 *
 * `EventSource` cannot set an `Authorization` header, which is why the session
 * JWT used to travel in the stream URL — and why 27 live session tokens were
 * found in one lane's dev log (#215). A ticket is exchanged for the session
 * over a normal authenticated request, so the credential in the URL is no
 * longer the session: it names one user, dies on first use, and expires in a
 * minute regardless.
 *
 * In memory, and deliberately so: `EventHub` already holds its subscribers in
 * the process that owns the socket, so a stream is only ever served by the
 * instance that issued its ticket. A shared store would buy nothing that the
 * event bus itself does not already need.
 */
export class StreamTicketStore {
  readonly #tickets = new Map<string, StoredTicket>();
  readonly #now: () => number;

  constructor(options: StreamTicketStoreOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  /** Issues a ticket for one user, and forgets the value on the way out. */
  issue(userId: string): IssuedStreamTicket {
    this.#sweep();

    const ticket = randomBytes(TICKET_BYTES).toString('base64url');
    const expiresAtMs = this.#now() + STREAM_TICKET_TTL_MS;

    this.#tickets.set(fingerprint(ticket), { userId, expiresAtMs });

    return { ticket, expiresAt: new Date(expiresAtMs) };
  }

  /**
   * Spends a ticket, returning the user it named — or `null` if it was never
   * issued, has already been spent, or has expired.
   *
   * The entry is removed before the expiry check, so a replay of an expired
   * ticket cannot keep it alive either.
   */
  consume(ticket: string): string | null {
    const key = fingerprint(ticket);
    const found = this.#tickets.get(key);

    if (!found) {
      return null;
    }

    this.#tickets.delete(key);

    return found.expiresAtMs > this.#now() ? found.userId : null;
  }

  /** Live entries, for the tests that assert the store does not leak. */
  get size(): number {
    return this.#tickets.size;
  }

  entries(): IterableIterator<[string, StoredTicket]> {
    return this.#tickets.entries();
  }

  /**
   * Drops what has expired. Every authenticated page load issues a ticket and
   * a ticket that is never consumed has nothing else to remove it, so without
   * this the map grows for the life of the process.
   */
  #sweep(): void {
    const now = this.#now();

    for (const [key, stored] of this.#tickets) {
      if (stored.expiresAtMs <= now) {
        this.#tickets.delete(key);
      }
    }
  }
}

/** Stored instead of the ticket, so a heap dump holds no usable credential. */
function fingerprint(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
