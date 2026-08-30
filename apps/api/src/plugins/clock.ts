import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    clock: Clock;
  }
}

/**
 * The current instant, as one named source rather than a call to `new Date()`
 * scattered through the handlers.
 */
export type Clock = () => Date;

export interface ClockPluginOptions {
  clock?: Clock;
}

/**
 * Decorates the instance with the clock every date-sensitive route reads.
 *
 * It exists because "today" was previously decided in two different places
 * that did not have to agree: application code derived it from the process's
 * UTC day, while `nearby-availability.dao.ts` asked Postgres for `CURRENT_DATE`
 * — which is the *database session's* day, set by a `TimeZone` nothing in this
 * repository controls. Under PGlite that session runs on `Etc/GMT+5`, so from
 * 00:00 UTC the two disagreed by a day and the API offered a date already past.
 *
 * Routing every "now" through one seam makes the disagreement impossible to
 * reintroduce: a handler that needs today takes it from here, and the DAO
 * receives it as a bound parameter instead of reading the connection's clock.
 */
export const clockPlugin = fp<ClockPluginOptions>(
  async (app, options) => {
    app.decorate('clock', options.clock ?? (() => new Date()));
  },
  { name: 'clock' },
);
