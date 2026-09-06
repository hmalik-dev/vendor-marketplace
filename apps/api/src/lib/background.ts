import type { FastifyBaseLogger } from 'fastify';

/**
 * Work a request starts but does not wait for.
 *
 * There is exactly one member of that class in this product — the transactional
 * email — and it earned the seam by being awaited on the request path for as
 * long as it existed. Every notification-bearing action sent its email inline:
 * a quote, an accept, a decline, and a list read that aged a batch of requests
 * out at once, each chain ending in a POST to Resend that carried no deadline.
 * The action itself had already committed by then, so the customer was waiting
 * on a call whose outcome could not change the answer they were about to get
 * (#408).
 *
 * Dispatching is not fire-and-forget: every task is tracked, so `drain` can
 * settle the outstanding ones. That is what makes shutdown safe — an instance
 * closing mid-flight would otherwise drop the send — and it is the same thing a
 * suite needs to assert on what was sent, which is why the two share one
 * mechanism rather than the tests observing a path production does not run.
 */
export interface BackgroundWork {
  /**
   * Starts `work` and returns immediately.
   *
   * `work` is expected to handle its own failures; anything that escapes is
   * logged here rather than becoming an unhandled rejection, because the caller
   * has already answered the request and has nowhere to report it.
   */
  run(work: () => Promise<void>): void;
  /** Settles every task dispatched so far, including ones they dispatch. */
  drain(): Promise<void>;
}

export function createBackgroundWork(log: FastifyBaseLogger): BackgroundWork {
  const inFlight = new Set<Promise<void>>();

  return {
    run(work) {
      const task = (async () => {
        try {
          await work();
        } catch (error) {
          log.error({ err: error }, 'Background work failed after the request was answered');
        }
      })();

      inFlight.add(task);
      void task.finally(() => inFlight.delete(task));
    },

    async drain() {
      /*
       * Looped, not a single `Promise.all`: a task may dispatch another, and
       * draining has to mean "nothing is left" rather than "nothing was left
       * when I looked".
       */
      while (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
      }
    },
  };
}
