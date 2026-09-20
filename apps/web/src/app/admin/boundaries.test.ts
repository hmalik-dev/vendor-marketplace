import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_DIR = join(process.cwd(), 'src/app/admin');

/*
 * A failed console read used to fall to the root boundary, which drops the
 * console's own header and rail (VEN-460). Both boundaries sit beside the
 * layout that draws them; the browser pass asserts what they render.
 */
describe('the console has boundaries of its own', () => {
  it('shows the page loader while a screen streams in', () => {
    const loading = join(ADMIN_DIR, 'loading.tsx');

    expect(existsSync(loading)).toBe(true);
    expect(readFileSync(loading, 'utf8')).toContain('PageLoader as default');
  });

  it('catches a throw as a client error boundary that keeps the console shell', () => {
    const errorFile = join(ADMIN_DIR, 'error.tsx');

    expect(existsSync(errorFile)).toBe(true);

    const source = readFileSync(errorFile, 'utf8');

    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).toContain('<ErrorScreen digest={error.digest} reset={reset} chrome={false} />');
  });
});
