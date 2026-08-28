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
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
