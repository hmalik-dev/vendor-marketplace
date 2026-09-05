import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    /*
     * The suite's timezone, pinned.
     *
     * Since #409 a rendered "today" is the *viewer's* day, read from the
     * browser's local clock — so a component test's result depends on the zone
     * the runner is in. Left to the machine, the same assertions passed in CI
     * (UTC) and failed in `Pacific/Auckland`, which is the shape of flakiness
     * `.claude/rules/testing.md` forbids outright: no real clock, and the
     * timezone is half of one.
     *
     * UTC because it is the zone with no offset to reason about. A test that
     * needs the viewer and the server to be on *different* days sets
     * `process.env.TZ` itself and restores it — `use-viewer-today.test.tsx`
     * does, and that is the point of pinning a known value to restore to.
     */
    env: { TZ: 'UTC' },
    /*
     * jsdom plus the Radix/cmdk mount work is slow, and `turbo run test` runs
     * every package's suite at once — the 5s default fails on load, not logic.
     *
     * 60s rather than 30s because the availability calendar renders twelve
     * months of buttons and took 30.5s in isolation: it sat *above* its own
     * ceiling, so it failed whenever the machine was busy and passed when it
     * was not, which reads as flakiness rather than as a slow test.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
    /*
     * `e2e/` holds two kinds of file and they run on different runners:
     * `*.spec.ts` are Playwright journeys needing a live server, `*.test.ts` are
     * ordinary unit tests over the harness's own helpers — the base-URL resolver
     * and the fixture-drift guard. Without this second glob those never ran,
     * which is the failure mode where a guard exists and defends nothing.
     */
    include: ['src/**/*.test.{ts,tsx}', 'e2e/**/*.test.ts'],
  },
});
