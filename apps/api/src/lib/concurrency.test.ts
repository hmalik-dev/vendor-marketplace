import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency.js';

describe('mapWithConcurrency', () => {
  /** A promise the test resolves by hand, so concurrency is observable. */
  function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((settle) => {
      resolve = settle;
    });

    return { promise, resolve };
  }

  /*
   * The property the expiry sweep depends on. `Promise.all` over the rows
   * opened one chain per expired request at once; this asserts the ceiling
   * holds by counting what is actually in flight rather than by timing.
   */
  it('never runs more than the limit at once', async () => {
    const gates = Array.from({ length: 7 }, deferred);
    let running = 0;
    let peak = 0;

    const all = mapWithConcurrency(gates, 3, async (gate) => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
      return running;
    });

    // Three started; the rest are queued behind them, not merely slower.
    await Promise.resolve();
    expect(running).toBe(3);

    for (const gate of gates) {
      gate.resolve();
      await Promise.resolve();
    }

    await all;
    expect(peak).toBe(3);
  });

  it('returns results in input order, not completion order', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (delay) => {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return delay;
    });

    expect(results).toEqual([30, 10, 20]);
  });

  it('starts no workers for an empty list', async () => {
    let calls = 0;

    const results = await mapWithConcurrency([], 4, async () => {
      calls += 1;
      return calls;
    });

    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});
