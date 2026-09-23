import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_DIR = join(process.cwd(), 'src/app/admin');

/*
 * A failed console read used to fall to the root boundary, which drops the
 * console's own header and rail (VEN-460). The error boundary sits beside the
 * layout that draws it; the browser pass asserts what it renders.
 */
describe('the console has boundaries of its own', () => {
  /*
   * VEN-654. A `loading.tsx` is a Suspense boundary, and whenever a screen's
   * read outlasts the shell, React streams the screen into a `hidden` node that
   * only a script reveals. With JavaScript off it stayed hidden: the Refine
   * bar's `Apply filters` submit, which exists for exactly that path (VEN-383),
   * was in the DOM and unreachable by Tab. Whether it streamed was timing, so it
   * passed on a fast lane and failed on every CI run.
   */
  it('does not stream a screen, so it renders whole with JavaScript off', () => {
    expect(existsSync(join(ADMIN_DIR, 'loading.tsx'))).toBe(false);
  });

  it('catches a throw as a client error boundary that keeps the console shell', () => {
    const errorFile = join(ADMIN_DIR, 'error.tsx');

    expect(existsSync(errorFile)).toBe(true);

    const source = readFileSync(errorFile, 'utf8');

    expect(source.startsWith("'use client';")).toBe(true);
    expect(source).toContain('<ErrorScreen digest={error.digest} reset={reset} chrome={false} />');
  });
});
