import fp from 'fastify-plugin';
import { createBackgroundWork, type BackgroundWork } from '../lib/background.js';

declare module 'fastify' {
  interface FastifyInstance {
    background: BackgroundWork;
  }
}

/**
 * Decorates the instance with the off-request-path work queue, and drains it on
 * close so a shutdown cannot drop a send that was already dispatched.
 */
export const backgroundPlugin = fp(
  async (app) => {
    const background = createBackgroundWork(app.log);

    app.decorate('background', background);
    app.addHook('onClose', async () => {
      await background.drain();
    });
  },
  { name: 'background' },
);
