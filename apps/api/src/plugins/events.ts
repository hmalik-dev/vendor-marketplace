import fp from 'fastify-plugin';
import { EventHub } from '../lib/event-stream.js';
import { StreamTicketStore } from '../lib/stream-tickets.js';

declare module 'fastify' {
  interface FastifyInstance {
    events: EventHub;
    streamTickets: StreamTicketStore;
  }
}

/**
 * The live-event hub, one per server instance.
 *
 * Decorated rather than imported as a module singleton so each test harness
 * gets its own — two suites sharing one hub would leak connections between
 * them, and the shutdown hook below would close another suite's sockets.
 */
export const eventsPlugin = fp(
  async (app) => {
    const hub = new EventHub();
    app.decorate('events', hub);

    /*
     * Beside the hub because it shares the hub's lifetime and its scope: a
     * ticket is only ever spent on the instance that issued it, which is the
     * same instance that holds the subscriber it names (#215).
     */
    app.decorate('streamTickets', new StreamTicketStore());

    // Streams are held open deliberately, so they have to be let go
    // deliberately too — otherwise `app.close()` never resolves.
    app.addHook('onClose', async () => hub.closeAll());
  },
  { name: 'events' },
);
