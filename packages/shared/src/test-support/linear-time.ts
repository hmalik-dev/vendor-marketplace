import { expect } from 'vitest';

const SMALL = 16 * 1024;
const GROWTH = 4;
const RUNS = 5;
/** Linear growth reads about 4, quadratic about 16; a noisy linear run stays well under this. */
const MAX_RATIO = 8;
/** Below this a timing is timer noise, so it is not allowed to shrink the denominator. */
const NOISE_FLOOR_MS = 1;
/** A backstop only: a slow runner passes the ratio and the ceiling, a hang fails both. */
const CEILING_MS = 2_000;

function medianMs(run: () => unknown): number {
  const samples: number[] = [];

  for (let index = 0; index < RUNS; index += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }

  return samples.sort((a, b) => a - b)[Math.floor(RUNS / 2)]!;
}

/**
 * Asserts `run` takes linear time in its input. It is timed on `SMALL` and on
 * `GROWTH` times that, and the two medians (after a warm-up) are compared, so a
 * slow or busy machine slows both sides alike; a fixed millisecond budget would
 * not survive a shared CI runner. `input` builds a hostile string of the size
 * it is given.
 */
export function expectLinearTime(input: (size: number) => string, run: (value: string) => unknown) {
  const small = input(SMALL);
  const large = input(SMALL * GROWTH);

  run(small);
  run(large);

  const smallMs = medianMs(() => run(small));
  const largeMs = medianMs(() => run(large));
  const ratio = largeMs / Math.max(smallMs, NOISE_FLOOR_MS);

  expect(largeMs, `${largeMs.toFixed(1)} ms on the large input`).toBeLessThan(CEILING_MS);
  expect(ratio, `${smallMs.toFixed(2)} ms -> ${largeMs.toFixed(2)} ms`).toBeLessThan(MAX_RATIO);
}
