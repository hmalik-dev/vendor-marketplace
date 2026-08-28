import type { ServerResponse } from 'node:http';

/**
 * A typed server-sent event. One stream carries both kinds, because a browser
 * is limited in how many connections it will hold open per origin and two
 * streams would spend that budget for no gain.
 */
export type StreamEvent =
  | { type: 'new_message'; conversationId: string; message: unknown }
  | { type: 'new_notification'; notification: unknown };

/**
 * The open SSE connections, by user.
 *
 * A `Set` per user rather than one connection: somebody with the site open in
 * three tabs is one user with three streams, and a message has to reach all of
 * them or two tabs quietly go stale.
 *
 * This lives in process memory, which is the honest limit of it — with more
 * than one API instance a subscriber on instance A will not see an event
 * published on instance B. Crossing that needs a shared bus (Redis, Postgres
 * LISTEN/NOTIFY); it is recorded rather than pretended away.
 */
export class EventHub {
  private readonly connections = new Map<string, Set<ServerResponse>>();

  /** Registers a connection and returns the function that removes it. */
  subscribe(userId: string, response: ServerResponse): () => void {
    const existing = this.connections.get(userId) ?? new Set<ServerResponse>();
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
   * Pushes to every connection this user has open.
   *
   * A write to a socket the client has already dropped throws, and that must
   * not fail the request that triggered it — sending a message is not allowed
   * to fail because the recipient closed a tab.
   */
  publish(userId: string, event: StreamEvent): void {
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
