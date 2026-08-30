import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKING_REQUEST_EXPIRY_DAYS, PLATFORM_FEE_COPY } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/**
 * Two facts the product kept stating in more than one place, and getting
 * different answers.
 *
 * **The deadline.** Four surfaces wrote it as a literal and three disagreed:
 * the review rail promised "48 hours", the success screen "after a week", the
 * booking card "expires in 7d", the vendor's notification "a week to reply".
 * The API had always written exactly `BOOKING_REQUEST_EXPIRY_DAYS`, so the
 * 48-hour claim was simply false — and it was the one shown at the moment of
 * commitment, which is the worst place to be wrong. On top of that, two
 * separate `expiryPhrase` helpers rendered the same stored `expiresAt`
 * differently, so the vendor saw "expires in 60h" where the customer saw
 * "expires in 3d".
 *
 * **The fee.** The customer was told "No service fee", the vendor "your share,
 * after the platform fee". Both were true — the commission comes out of the
 * total rather than on top of it — but nothing said so, and a beta user
 * comparing notes with their vendor would read a contradiction.
 *
 * Neither is the kind of defect a type checker or a rendering test finds: every
 * one of those strings was individually well-formed. What was wrong was that
 * there was more than one of them.
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

  it('derives the window phrase from the constant', async () => {
    const { bookingRequestWindowPhrase } = await import('@vendor-marketplace/shared');

    expect(bookingRequestWindowPhrase()).toBe(`${BOOKING_REQUEST_EXPIRY_DAYS} days`);
  });
});

describe('one fee model', () => {
  it('draws both sides of the fee story from one shared source', async () => {
    const railSource = await readFile(
      path.join(SRC, 'components', 'bookings', 'bookings-rail.tsx'),
      'utf8',
    );
    const dashboardSource = await readFile(
      path.join(SRC, 'components', 'vendor', 'dashboard-stats.tsx'),
      'utf8',
    );

    expect(railSource).toContain('PLATFORM_FEE_COPY.customer');
    expect(dashboardSource).toContain('PLATFORM_FEE_COPY.vendor.delta');

    // Neither may restate its half as a literal beside the shared one.
    const railCode = railSource.replace(/\/\*[\s\S]*?\*\//g, '');
    const dashboardCode = dashboardSource.replace(/\/\/[^\n]*/g, '');
    expect(railCode).not.toMatch(/'The price you.re quoted is the price you pay\.'/);
    expect(dashboardCode).not.toMatch(/"Your share, after the platform fee"/);
  });

  /*
   * The two voices have to be compatible, not identical. The customer's half
   * says nothing is added; the vendor's half has to say where the commission
   * comes from, or the pair reads as a contradiction again.
   */
  it('has the vendor line explain that the customer pays nothing on top', () => {
    expect(PLATFORM_FEE_COPY.customer.title).toBe('No service fee.');
    expect(PLATFORM_FEE_COPY.vendor.delta).toMatch(/never pays on top/);
  });
});
