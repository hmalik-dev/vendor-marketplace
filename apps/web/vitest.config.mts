import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // jsdom plus the Radix/cmdk mount work is slow, and `turbo run test` runs
    // every package's suite at once — the 5s default fails on load, not logic.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
