import { expect } from 'vitest';

const SMALL = 16 * 1024;
const GROWTH = 4;
const RUNS = 7;
/** Each timed sample repeats the call until it lasts about this long, so timer and scheduler noise is small against it. */
const SAMPLE_MS = 20;
const MAX_REPEATS = 2_000;
/** Linear growth reads about 4, quadratic about 16; a noisy linear run stays well under this. */
const MAX_RATIO = 8;
/** A backstop only: a slow runner passes the ratio and the ceiling, a hang fails both. */
const CEILING_MS = 2_000;

function timeOnce(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

/** The fastest of `RUNS` samples of `repeats` calls: noise only ever adds time, so the minimum is the least disturbed. */
function fastestMs(run: () => unknown, repeats: number): number {
  let fastest = Infinity;

  for (let sample = 0; sample < RUNS; sample += 1) {
    fastest = Math.min(
      fastest,
      timeOnce(() => {
        for (let call = 0; call < repeats; call += 1) {
          run();
        }
      }),
    );
  }

  return fastest;
}

/**
 * Asserts `run` takes linear time in its input. It is timed on `SMALL` and on
 * `GROWTH` times that, and the two are compared, so a slow or busy machine slows
 * both sides alike; a fixed millisecond budget would not survive a shared CI
 * runner. Both sides repeat the call the same number of times, chosen so the
 * small side lasts about `SAMPLE_MS`, because a sub-millisecond reading is
 * mostly noise. `input` builds a hostile string of the size it is given.
 */
export function expectLinearTime(input: (size: number) => string, run: (value: string) => unknown) {
  const small = input(SMALL);
  const large = input(SMALL * GROWTH);

  run(small);
  run(large);

  const singleMs = Math.max(
    timeOnce(() => run(small)),
    0.001,
  );
  const repeats = Math.min(MAX_REPEATS, Math.max(1, Math.ceil(SAMPLE_MS / singleMs)));
  const smallMs = fastestMs(() => run(small), repeats);
  const largeMs = fastestMs(() => run(large), repeats);
  const ratio = largeMs / smallMs;

  expect(
    largeMs / repeats,
    `${(largeMs / repeats).toFixed(1)} ms per call on the large input`,
  ).toBeLessThan(CEILING_MS);
  expect(
    ratio,
    `${smallMs.toFixed(2)} ms -> ${largeMs.toFixed(2)} ms over ${repeats} calls`,
  ).toBeLessThan(MAX_RATIO);
}
