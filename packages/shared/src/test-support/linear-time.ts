import { expect } from 'vitest';

/**
 * Long enough that quadratic work, about n²/2 steps, takes seconds: the
 * `/\/+$/` trim took 3.6 s and the unanchored JWT scrub 1.4 s at half this.
 */
const HOSTILE_SIZE = 200_000;
/**
 * The slowest linear caller, the full error scrubber, takes about 27 ms on
 * `HOSTILE_SIZE` characters and the trims well under one, so this budget is a
 * margin of over 35 times a loaded runner cannot eat, while quadratic work
 * misses it several times over. Tightening it narrows that margin: a ratio of
 * two timings was tighter and flaked a release at 24.0013 against 24 (VEN-758).
 */
const BUDGET_MS = 1_000;

/**
 * Asserts `run` is not superlinear in its input: one call on a hostile string
 * of `HOSTILE_SIZE` characters, built by `input`, finishes inside `BUDGET_MS`.
 */
export function expectLinearTime(
  input: (size: number) => string,
  run: (value: string) => unknown,
): void {
  const hostile = input(HOSTILE_SIZE);
  const started = performance.now();

  run(hostile);

  const elapsedMs = performance.now() - started;

  expect(elapsedMs, `${elapsedMs.toFixed(1)} ms on ${hostile.length} characters`).toBeLessThan(
    BUDGET_MS,
  );
}
