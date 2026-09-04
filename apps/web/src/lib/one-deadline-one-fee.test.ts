import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONEY_COPY } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/**
 * Two facts the product kept stating in more than one place, and getting
 * different answers.
 *
 * **The deadline.** Four surfaces wrote it as a literal and three disagreed:
 * the review rail promised "48 hours", the success screen "after a week", the
 * booking card "expires in 7d", the vendor's notification "a week to reply".
 * The API then wrote exactly one window, so the 48-hour claim was simply
 * false — and it was the one shown at the moment of
 * commitment, which is the worst place to be wrong. On top of that, two
 * separate `expiryPhrase` helpers rendered the same stored `expiresAt`
 * differently, so the vendor saw "expires in 60h" where the customer saw
 * "expires in 3d".
 *
 * **The money.** The customer was told "No service fee", the vendor "your
 * share, after the platform fee", and #217 asked for the two to be reconciled.
 * Reconciling them was the wrong fix: `98-post-mvp.md` defers **all** fee
 * language on vendor surfaces, so the vendor line was never an inconsistency to
 * explain — it was a Post-MVP claim that should not have shipped, and writing
 * more fee copy to reconcile it would have inverted the deferral. The customer
 * keeps its half, the vendor is told the mechanism, and the claim is kept out
 * by `components/vendor/no-vendor-fee-language.test.ts`.
 *
 * Neither is the kind of defect a type checker or a rendering test finds: every
 * one of those strings was individually well-formed. What was wrong was that
 * there was more than one of them — and, in the fee's case, that one of them
 * should not have existed at all.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Durations a user-facing string must not hard-code for **this** deadline.
 *
 * Deliberately narrow. "48 hours" is also the cancellation cutoff
 * (`FULL_REFUND_CUTOFF_HOURS`) and a vendor response-time option, both of which
 * are different facts that legitimately name a duration — so the guard matches
 * the phrasings that were actually wrong rather than every number in the app.
 */
const BANNED_DEADLINE_PHRASES = [
  /\b48 hours to (?:confirm|reply|respond)/i,
  /closes on its own after a week/i,
  /(?:you have|has) a week to (?:reply|respond|confirm)/i,
];

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(full)));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      found.push(full);
    }
  }

  return found;
}

describe('one deadline', () => {
  it('finds the sources it is meant to be guarding', async () => {
    const files = await sourceFiles(SRC);

    // Guards the guard: a scan matching nothing passes forever while the rule
    // it encodes goes unenforced.
    expect(files.length).toBeGreaterThan(50);
  });

  it('states the request window from the constant, never as a literal', async () => {
    const files = await sourceFiles(SRC);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      // Prose explaining the defect is not an instance of it.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      for (const pattern of BANNED_DEADLINE_PHRASES) {
        if (pattern.test(code)) {
          offenders.push(`${path.relative(SRC, file)} matches ${String(pattern)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * The countdown is one function now. A second one is how the two sides drifted
   * the first time, and it drifted under the same name, so grepping for the name
   * is exactly the check that would have caught it.
   */
  it('keeps one countdown implementation, in the shared package', async () => {
    const files = await sourceFiles(SRC);

    const redefiners: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      if (/function\s+(?:expiryPhrase|expiryCountdown)\s*\(/.test(code)) {
        redefiners.push(path.relative(SRC, file));
      }
    }

    expect(redefiners).toEqual([]);
  });

  /*
   * There is no flat window phrase any more. `bookingRequestWindowPhrase`
   * returned a flat day count and every surface read it,
   * which was right while every request got a week — #401 capped the window at
   * the event date, so the only true statement of this deadline is the row's
   * own `expiresAt`. The helper is gone rather than left as a ceiling nobody
   * should reach for, and this asserts nothing brings it back under a new name.
   */
  it('states the reply deadline only from the row, never as a length', async () => {
    const files = await sourceFiles(SRC);

    const restaters: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      if (/BOOKING_REQUEST_EXPIRY_DAYS/.test(code) || /bookingRequestWindowPhrase/.test(code)) {
        restaters.push(path.relative(SRC, file));
      }
    }

    expect(restaters).toEqual([]);
  });
});

describe('one money story', () => {
  it('draws the customer promise from the shared source', async () => {
    const railSource = await readFile(
      path.join(SRC, 'components', 'bookings', 'bookings-rail.tsx'),
      'utf8',
    );

    expect(railSource).toContain('MONEY_COPY.customer');
    // It may not restate its half as a literal beside the shared one.
    const railCode = railSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(railCode).not.toMatch(/'The price you.re quoted is the price you pay\.'/);
  });

  /*
   * The vendor half is not a second phrasing of the fee — it is the absence of
   * one. `98-post-mvp.md` defers every fee claim on a vendor surface, so the
   * dashboard states the payment mechanism and nothing about the money split.
   * `components/vendor/no-vendor-fee-language.test.ts` holds that line across
   * every vendor component; this only pins the one string.
   */
  it('tells the vendor the mechanism, not the fee', async () => {
    const dashboardSource = await readFile(
      path.join(SRC, 'components', 'vendor', 'dashboard-stats.tsx'),
      'utf8',
    );

    expect(dashboardSource).toContain('MONEY_COPY.vendorPayout');
    expect(dashboardSource).not.toMatch(/platform fee/i);
    expect(MONEY_COPY.vendorPayout).toBe('Paid out after each event');
  });
});
