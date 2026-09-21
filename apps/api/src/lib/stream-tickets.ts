import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, gt, lte } from 'drizzle-orm';
import { streamTickets } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from './database.js';
import { tooManyRequests } from './errors.js';

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

/** Unspent tickets one user may hold at once; the next exchange is refused. */
export const MAX_OUTSTANDING_TICKETS = 10;

/** Bytes of randomness per ticket — 43 base64url characters. */
const TICKET_BYTES = 32;

export interface IssuedStreamTicket {
  /** The opaque value handed to the browser. Never stored. */
  readonly ticket: string;
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
 * **In Postgres, so any instance can spend what any instance issued** (VEN-462):
 * issue and connect are two independent requests, and a rolling deploy briefly
 * runs two containers whatever the replica setting. Spending is one
 * `delete … returning`, so two instances racing on one ticket have exactly one
 * winner. Only the SHA-256 is stored.
 *
 * `EventHub`'s subscriber map stays process-local: it governs event delivery,
 * not admission.
 */
export class StreamTicketStore {
  readonly #db: AppDatabase;
  readonly #now: () => number;

  constructor(db: AppDatabase, options: StreamTicketStoreOptions = {}) {
    this.#db = db;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Issues a ticket for one user, and forgets the value on the way out.
   * Refused with 429 while the user already holds {@link MAX_OUTSTANDING_TICKETS}
   * unspent, unexpired ones.
   */
  async issue(userId: string): Promise<IssuedStreamTicket> {
    const now = new Date(this.#now());

    const [held] = await this.#db
      .select({ n: count() })
      .from(streamTickets)
      .where(and(eq(streamTickets.userId, userId), gt(streamTickets.expiresAt, now)));

    if ((held?.n ?? 0) >= MAX_OUTSTANDING_TICKETS) {
      throw tooManyRequests('Too many live-update tickets are outstanding; try again shortly');
    }

    const ticket = randomBytes(TICKET_BYTES).toString('base64url');

    await this.#db.insert(streamTickets).values({
      fingerprint: fingerprint(ticket),
      userId,
      expiresAt: new Date(now.getTime() + STREAM_TICKET_TTL_MS),
    });

    return { ticket };
  }

  /**
   * Spends a ticket, returning the user it named — or `null` if it was never
   * issued, has already been spent, or has expired.
   *
   * The row is deleted before the expiry check, so a replay of an expired
   * ticket cannot keep it alive either.
   */
  async consume(ticket: string): Promise<string | null> {
    const [spent] = await this.#db
      .delete(streamTickets)
      .where(eq(streamTickets.fingerprint, fingerprint(ticket)))
      .returning({ userId: streamTickets.userId, expiresAt: streamTickets.expiresAt });

    return spent && spent.expiresAt.getTime() > this.#now() ? spent.userId : null;
  }

  /**
   * Drops what has expired. Run by the expiry timer rather than on every issue:
   * an unindexed delete per page load would scan the table each time, and the
   * cap below already ignores expired rows.
   */
  async sweep(): Promise<void> {
    await this.#db.delete(streamTickets).where(lte(streamTickets.expiresAt, new Date(this.#now())));
  }
}

/** Stored instead of the ticket, so a database dump holds no usable credential. */
function fingerprint(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
