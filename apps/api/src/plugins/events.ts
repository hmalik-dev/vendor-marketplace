import fp from 'fastify-plugin';
import { PostgresEventBus, type ListenFn } from '../lib/event-bus.js';
import { EventHub } from '../lib/event-stream.js';
import { StreamTicketStore } from '../lib/stream-tickets.js';

declare module 'fastify' {
  interface FastifyInstance {
    events: EventHub;
    streamTickets: StreamTicketStore;
  }
}

export interface EventsPluginOptions {
  /** A `LISTEN` on a connection of its own, which is how events from the other instances arrive. */
  listen: ListenFn;
}

/**
 * The live-event hub, one per server instance, joined to every other instance
 * over Postgres `LISTEN/NOTIFY` (VEN-650).
 *
 * Decorated rather than imported as a module singleton so each test harness
 * gets its own — two suites sharing one hub would leak connections between
 * them, and the shutdown hook below would close another suite's sockets.
 */
export const eventsPlugin = fp<EventsPluginOptions>(
  async (app, options) => {
    const hub = new EventHub({
      bus: new PostgresEventBus(app.db, options.listen, app.log),
      log: app.log,
    });
    app.decorate('events', hub);

    // At boot, so an API that cannot hear the other instances fails to start rather than serving half a live surface.
    const stopListening = await hub.start();
    app.addHook('onClose', async () => {
      try {
        await stopListening();
      } catch (error) {
        // Shutting down regardless; a connection already gone has nothing left to unlisten.
        app.log.warn({ err: error }, 'The realtime listener did not stop cleanly');
      }
    });

    /*
     * In Postgres, so a ticket issued by one instance is spent by any other —
     * a rolling deploy runs two (VEN-462).
     */
    app.decorate(
      'streamTickets',
      new StreamTicketStore(app.db, { now: () => app.clock().getTime() }),
    );

    /*
     * Streams are held open deliberately, so they have to be let go
     * deliberately too — and *before* the server is asked to stop.
     *
     * `onClose` is too late for the streams: Fastify's own hook calls `server.close()` first,
     * which waits for every connection to finish and so waits on the stream
     * forever, and the hooks queued behind it — this one and the background
     * queue's drain — never run. `preClose` runs ahead of it.
     */
    app.addHook('preClose', async () => hub.closeAll());
  },
  { name: 'events', dependencies: ['database', 'clock'] },
);
