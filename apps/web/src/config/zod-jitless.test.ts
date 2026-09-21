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

  it('still parses objects', () => {
    disableZodJit();

    expect(z.object({ a: z.string() }).parse({ a: 'x' })).toEqual({ a: 'x' });
    expect(z.object({ a: z.string() }).safeParse({ a: 1 }).success).toBe(false);
  });
});
