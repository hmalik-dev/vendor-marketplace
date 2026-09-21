import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { disableZodJit } from './zod-jitless';

describe('disableZodJit', () => {
  afterEach(() => {
    z.config({ jitless: false });
    vi.restoreAllMocks();
  });

  it('turns zod jitless, so it never probes for eval under a CSP without unsafe-eval', () => {
    expect(z.config().jitless).not.toBe(true);

    disableZodJit();

    expect(z.config().jitless).toBe(true);
  });

  /*
   * Zod probes for eval when a schema is *constructed*, and importing the
   * shared package constructs them all — so this has to be the entry's first
   * import. A source check: the rendered result is the browser's
   * `securitypolicyviolation` event.
   */
  it('is the first import of the client entry, ahead of anything that builds a schema', () => {
    const entry = readFileSync(join(process.cwd(), 'src/instrumentation-client.ts'), 'utf8');
    const firstImport = /^import .*$/m.exec(entry)?.[0];

    expect(firstImport).toBe("import './config/zod-jitless-init';");
  });

  it('still parses objects', () => {
    disableZodJit();

    expect(z.object({ a: z.string() }).parse({ a: 'x' })).toEqual({ a: 'x' });
    expect(z.object({ a: z.string() }).safeParse({ a: 1 }).success).toBe(false);
  });
});
