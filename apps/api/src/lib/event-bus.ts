import { realtimeEvents } from '@vendor-marketplace/db/schema';
import { eq, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from './database.js';
import type { StreamEvent } from './event-stream.js';

/** The one channel every API instance listens on. */
export const REALTIME_CHANNEL = 'orla_realtime';

/**
 * The largest payload sent inline. Postgres refuses a `NOTIFY` payload of 8000
 * bytes or more; anything larger travels through `realtime_events` instead.
 */
export const NOTIFY_PAYLOAD_LIMIT_BYTES = 7_900;

/**
 * How long a spilled event is kept. Every listener reads it the moment the
 * notification lands, so a minute is generous, and older rows are dropped by
 * the next spill.
 */
const SPILL_RETENTION_MS = 60_000;

/** What one instance tells the others. `origin` lets the sender skip its own. */
export type BusEnvelope = { origin: string; userId: string } & (
  { kind: 'publish'; event: StreamEvent } | { kind: 'close' }
);

/** A notification as the bus sends it: the envelope itself, or where to read it. */
type Wire = BusEnvelope | { ref: string };

/**
 * Subscribes to a channel on a connection that stays open, and returns the
 * function that stops. The driver owns reconnecting.
 */
export type ListenFn = (
  channel: string,
  onPayload: (payload: string) => void,
) => Promise<() => Promise<void>>;

export interface EventBus {
  send(envelope: BusEnvelope): Promise<void>;
  listen(onEnvelope: (envelope: BusEnvelope) => void): Promise<() => Promise<void>>;
}

export interface EventBusLog {
  warn: (object: object, message: string) => void;
  error: (object: object, message: string) => void;
}

/**
 * Live events over Postgres `LISTEN/NOTIFY` (VEN-650), so a message sent to
 * one API instance reaches a stream held open by another — a rolling deploy
 * runs two, and before this the live messages sent during that overlap were
 * simply lost to whoever was connected to the other one.
 *
 * `NOTIFY` is sent over the ordinary pool; listening needs a connection of its
 * own that stays open, which the caller provides as {@link ListenFn}.
 */
export class PostgresEventBus implements EventBus {
  readonly #db: AppDatabase;
  readonly #listen: ListenFn;
  readonly #log: EventBusLog;

  constructor(db: AppDatabase, listen: ListenFn, log: EventBusLog) {
    this.#db = db;
    this.#listen = listen;
    this.#log = log;
  }

  async send(envelope: BusEnvelope): Promise<void> {
    const inline = JSON.stringify(envelope);

    if (Buffer.byteLength(inline) <= NOTIFY_PAYLOAD_LIMIT_BYTES) {
      await this.#notify(inline);
      return;
    }

    const [row] = await this.#db
      .insert(realtimeEvents)
      .values({ payload: inline })
      .returning({ id: realtimeEvents.id });

    if (!row) {
      throw new Error('A spilled realtime event was not stored');
    }

    await this.#notify(JSON.stringify({ ref: row.id } satisfies Wire));
    await this.#db
      .delete(realtimeEvents)
      .where(lt(realtimeEvents.createdAt, new Date(Date.now() - SPILL_RETENTION_MS)));
  }

  listen(onEnvelope: (envelope: BusEnvelope) => void): Promise<() => Promise<void>> {
    return this.#listen(REALTIME_CHANNEL, (payload) => {
      void this.#receive(payload, onEnvelope).catch((error: unknown) => {
        // Nothing waits on a notification: the loss is logged, never thrown.
        this.#log.error({ err: error }, 'A realtime event could not be read from the bus');
      });
    });
  }

  async #notify(payload: string): Promise<void> {
    await this.#db.execute(sql`select pg_notify(${REALTIME_CHANNEL}, ${payload})`);
  }

  async #receive(payload: string, onEnvelope: (envelope: BusEnvelope) => void): Promise<void> {
    const wire = parseWire(payload);

    if (!wire) {
      this.#log.warn({ bytes: payload.length }, 'An unreadable realtime notification was ignored');
      return;
    }

    if (!('ref' in wire)) {
      onEnvelope(wire);
      return;
    }

    const [row] = await this.#db
      .select({ payload: realtimeEvents.payload })
      .from(realtimeEvents)
      .where(eq(realtimeEvents.id, wire.ref));
    const spilled = row ? parseWire(row.payload) : null;

    if (!spilled || 'ref' in spilled) {
      this.#log.warn({ ref: wire.ref }, 'A spilled realtime event was gone before it was read');
      return;
    }

    onEnvelope(spilled);
  }
}

/** The shape check a payload from the wire gets before anything acts on it. */
function parseWire(payload: string): Wire | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  if ('ref' in parsed) {
    return typeof parsed.ref === 'string' ? { ref: parsed.ref } : null;
  }

  const candidate = parsed as Partial<Record<keyof BusEnvelope | 'event', unknown>>;

  if (typeof candidate.origin !== 'string' || typeof candidate.userId !== 'string') {
    return null;
  }

  if (candidate.kind === 'close') {
    return { origin: candidate.origin, userId: candidate.userId, kind: 'close' };
  }

  if (candidate.kind === 'publish' && typeof candidate.event === 'object' && candidate.event) {
    return {
      origin: candidate.origin,
      userId: candidate.userId,
      kind: 'publish',
      // Written by `send` above, from a typed event; the channel is not reachable from outside.
      event: candidate.event as StreamEvent,
    };
  }

  return null;
}
