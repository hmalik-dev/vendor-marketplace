import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { BusEnvelope, EventBus, EventBusLog } from './event-bus.js';

/**
 * A typed server-sent event. One stream carries both kinds, because a browser
 * is limited in how many connections it will hold open per origin and two
 * streams would spend that budget for no gain.
 */
export type StreamEvent =
  | { type: 'new_message'; conversationId: string; message: unknown }
  | { type: 'new_notification'; notification: unknown };

/** Concurrent streams one user may hold on one instance (VEN-462). */
export const MAX_STREAMS_PER_USER = 5;

export interface EventHubOptions {
  /** What carries events to the other instances. Without one the hub reaches only its own streams. */
  bus?: EventBus;
  log?: EventBusLog;
}

/**
 * The open SSE connections, by user, and the fan-out to them.
 *
 * A `Set` per user rather than one connection: somebody with the site open in
 * three tabs is one user with three streams, and a message has to reach all of
 * them or two tabs quietly go stale.
 *
 * The connections are this process's own; the events are not (VEN-650). A
 * publish is delivered to this instance's streams at once and sent over the
 * bus to every other instance, which delivers it to theirs — so a message sent
 * through instance A reaches a tab whose stream is held by instance B. The
 * sender skips its own echo by `origin`, so nothing is delivered twice.
 */
export class EventHub {
  private readonly connections = new Map<string, Set<ServerResponse>>();
  readonly #origin = randomUUID();
  readonly #bus: EventBus | undefined;
  readonly #log: EventBusLog | undefined;

  constructor(options: EventHubOptions = {}) {
    this.#bus = options.bus;
    this.#log = options.log;
  }

  /** Starts taking events from the other instances; returns the function that stops. */
  async start(): Promise<() => Promise<void>> {
    if (!this.#bus) {
      return async () => undefined;
    }

    return this.#bus.listen((envelope) => this.#receive(envelope));
  }

  /**
   * Registers a connection and returns the function that removes it, or `null`
   * when the user already has {@link MAX_STREAMS_PER_USER} open — each holds a
   * heartbeat and a subscription, and nobody needs more tabs than that.
   */
  subscribe(userId: string, response: ServerResponse): (() => void) | null {
    const existing = this.connections.get(userId) ?? new Set<ServerResponse>();

    if (existing.size >= MAX_STREAMS_PER_USER) {
      return null;
    }

    existing.add(response);
    this.connections.set(userId, existing);

    return () => {
      const current = this.connections.get(userId);
      if (!current) {
        return;
      }

      current.delete(response);
      if (current.size === 0) {
        this.connections.delete(userId);
      }
    };
  }

  /**
   * Pushes to every connection this user has open, on every instance.
   *
   * Never throws and never waits: sending a message is not allowed to fail
   * because the recipient closed a tab, or because the bus is down — the
   * message is stored either way, and a stream that reconnects re-reads it.
   */
  publish(userId: string, event: StreamEvent): void {
    this.#deliver(userId, event);
    this.#broadcast({ origin: this.#origin, userId, kind: 'publish', event });
  }

  /**
   * A write to a socket the client has already dropped throws; that socket is
   * forgotten rather than failing the publish.
   */
  #deliver(userId: string, event: StreamEvent): void {
    const targets = this.connections.get(userId);

    if (!targets) {
      return;
    }

    const frame = `data: ${JSON.stringify(event)}\n\n`;

    for (const response of targets) {
      try {
        response.write(frame);
      } catch {
        targets.delete(response);
      }
    }
  }

  /** How many connections a user has open. Test and diagnostic use only. */
  countFor(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /**
   * Ends every stream one user has open, on every instance — a ban or a
   * closure, after which a tab left open must stop receiving message content
   * and notifications.
   */
  closeFor(userId: string): void {
    this.#end(userId);
    this.#broadcast({ origin: this.#origin, userId, kind: 'close' });
  }

  #end(userId: string): void {
    const targets = this.connections.get(userId);

    if (!targets) {
      return;
    }

    this.connections.delete(userId);

    for (const response of targets) {
      try {
        response.end();
      } catch {
        // Already gone; nothing to close.
      }
    }
  }

  #receive(envelope: BusEnvelope): void {
    if (envelope.origin === this.#origin) {
      return;
    }

    if (envelope.kind === 'close') {
      this.#end(envelope.userId);
    } else {
      this.#deliver(envelope.userId, envelope.event);
    }
  }

  #broadcast(envelope: BusEnvelope): void {
    if (!this.#bus) {
      return;
    }

    // Fire-and-forget by design (see `publish`); the failure is logged, not thrown.
    void this.#bus.send(envelope).catch((error: unknown) => {
      this.#log?.error(
        { err: error, userId: envelope.userId, kind: envelope.kind },
        'A realtime event could not be sent to the other instances',
      );
    });
  }

  /** Ends every open stream — the shutdown path, so sockets are not leaked. */
  closeAll(): void {
    for (const targets of this.connections.values()) {
      for (const response of targets) {
        try {
          response.end();
        } catch {
          // Already gone; nothing to close.
        }
      }
    }

    this.connections.clear();
  }
}
