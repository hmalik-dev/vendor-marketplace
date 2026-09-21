import { z } from 'zod';

/**
 * Zod 4 probes `new Function('')` before its first object parse to decide
 * whether it may compile validators. Under a CSP with no `'unsafe-eval'` the
 * probe throws and is caught, but the browser still raises a
 * `securitypolicyviolation` for it on every page (VEN-523). Jitless skips the
 * probe and parses the interpreted way, which is what a blocked probe fell
 * back to anyway.
 *
 * Called by `zod-jitless-init.ts`, the first import of `instrumentation-client.ts`.
 */
export function disableZodJit(): void {
  z.config({ jitless: true });
}
