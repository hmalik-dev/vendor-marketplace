import fp from 'fastify-plugin';
import { EventHub } from '../lib/event-stream.js';

declare module 'fastify' {
  interface FastifyInstance {
    events: EventHub;
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

    // Streams are held open deliberately, so they have to be let go
    // deliberately too — otherwise `app.close()` never resolves.
    app.addHook('onClose', async () => hub.closeAll());
  },
  { name: 'events' },
);
