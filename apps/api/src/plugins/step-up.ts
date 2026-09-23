import fp from 'fastify-plugin';
import { StepUpStore } from '../lib/step-up.js';

declare module 'fastify' {
  interface FastifyInstance {
    stepUp: StepUpStore;
  }
}

export interface StepUpPluginOptions {
  /** The suites' seam; production always builds the real store. */
  store?: StepUpStore;
}

/** Decorates the instance with the store every irreversible admin route asks. */
export const stepUpPlugin = fp<StepUpPluginOptions>(
  async (app, options) => {
    app.decorate('stepUp', options.store ?? new StepUpStore(app.db));
  },
  { name: 'step-up', dependencies: ['database'] },
);
