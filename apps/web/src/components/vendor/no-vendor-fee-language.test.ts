import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONEY_COPY } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/**
 * No vendor-facing surface makes a fee claim, in either direction.
 *
 * `98-post-mvp.md` defers **all** fee language on vendor surfaces: "Not 'no
 * fees', not a rate, not a hint." The vendor model — service fee, commission or
 * subscription — is not settled, and a claim walked back later costs more trust
 * than saying nothing now. The customer's "no service fee on top" is true of
 * the customer's half of the transaction and is a real differentiator there; it
 * "must not be mirrored, or negated, onto the vendor side".
 *
 * The dashboard shipped "Your share, after the platform fee" anyway, and #217
 * read that as an inconsistency with the customer's promise and asked for the
 * two to be reconciled. Reconciling them would have written **more** fee
 * language onto the vendor side, which is the deferral inverted. The line is
 * gone; the vendor is told the mechanism instead, which holds under any model.
 *
 * This guard is the reason that stays true. The Post-MVP register is prose in a
 * file nobody imports, so nothing was stopping the claim coming back — and the
 * ticket asking for it back was already written.
 */
const FEE_LANGUAGE = [
  /\bplatform fee\b/i,
  /\bservice fee\b/i,
  /\bcommission\b/i,
  /\bour (?:cut|share)\b/i,
  /\bno fees?\b/i,
  /\d\s*%/,
];

const VENDOR_DIR = path.dirname(fileURLToPath(import.meta.url));

async function vendorSurfaces(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await vendorSurfaces(full)));
    } else if (/\.tsx$/.test(entry.name) && !entry.name.includes('.test.')) {
      found.push(full);
    }
  }

  return found;
}

describe('vendor surfaces make no fee claim', () => {
  it('finds the surfaces it is meant to be guarding', async () => {
    const files = await vendorSurfaces(VENDOR_DIR);

    // Guards the guard: an empty scan would pass forever.
    expect(files.length).toBeGreaterThan(3);
  });

  it('names no fee, rate, commission or share anywhere in vendor components', async () => {
    const files = await vendorSurfaces(VENDOR_DIR);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      // Prose explaining the deferral is not a claim made to a vendor.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      for (const pattern of FEE_LANGUAGE) {
        if (pattern.test(code)) {
          offenders.push(`${path.relative(VENDOR_DIR, file)} matches ${String(pattern)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * The replacement has to be about the mechanism rather than the money, or it
   * is the same claim in gentler words.
   */
  it('tells the vendor the mechanism instead', () => {
    expect(MONEY_COPY.vendorPayout).toBe('Paid out after each event');

    for (const pattern of FEE_LANGUAGE) {
      expect(pattern.test(MONEY_COPY.vendorPayout)).toBe(false);
    }
  });

  /* The customer's half is a real differentiator and is deliberately kept. */
  it('leaves the customer promise intact', () => {
    expect(MONEY_COPY.customer.title).toBe('No service fee.');
  });
});
