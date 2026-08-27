import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * The product name has already moved twice (VendorHub -> VenMatch -> Orla), and
 * each move left literals behind in page titles, chrome and copy. It now lives
 * in `packages/shared/src/constants/brand.ts` and nowhere else, so a rename is
 * a one-line change rather than an archaeology exercise.
 *
 * Every name the product has ever had is checked, not just the current one: a
 * stale `VenMatch` is exactly as broken as a hardcoded `Orla`.
 */
const FORBIDDEN_LITERALS = ['Orla', 'VenMatch', 'VendorHub', 'venmatch', 'orla.com'];

/** This guard names the literals it forbids, so it has to exempt itself. */
const ALLOWED_PATHS = ['src/components/brand/brand-literals.test.ts'];

function grepFor(literal: string): string[] {
  try {
    const output = execFileSync(
      'git',
      // `--untracked` so a brand-new file cannot slip past the guard.
      ['grep', '--no-color', '--untracked', '-l', '-F', literal, '--', 'src'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    return output.split('\n').filter(Boolean);
  } catch (error) {
    // `git grep` exits 1 with no output when nothing matches, which is a pass.
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return [];
    }

    throw error;
  }
}

describe('brand literals', () => {
  it.each(FORBIDDEN_LITERALS)('never hardcodes %s anywhere in apps/web/src', (literal) => {
    const offenders = grepFor(literal).filter((path) => !ALLOWED_PATHS.includes(path));

    expect(offenders).toEqual([]);
  });

  it('finds the literal when one is present, so the guard cannot pass vacuously', () => {
    // This file contains the strings above, so the raw grep must see itself.
    expect(grepFor('VenMatch')).toContain('src/components/brand/brand-literals.test.ts');
  });
});
