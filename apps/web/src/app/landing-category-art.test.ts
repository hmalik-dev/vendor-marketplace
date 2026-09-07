import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_SEEDS, LANDING_CATEGORY_COUNT } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * The landing category cards render `/categories/<slug>.jpg` through
 * `StockPhoto`, which is a `next/image` with no fallback: a missing file is a
 * broken card on the front door, and `next build` does not catch it because the
 * path is built from a constant at render time rather than imported.
 *
 * That makes promoting a category into the landing set a two-part change —
 * reorder `CATEGORY_SEEDS`, and ship the photograph — and the second half is
 * easy to forget because nothing fails until someone looks at the page.
 * Discovered 2026-09-06: `carts` has no image, so it cannot be promoted until
 * one exists.
 *
 * A labelled placeholder is not the escape hatch. D26 and D17 ruling 2 both
 * forbid one on a public surface — a coverless card takes a neutral tone block,
 * never a hatch and never a developer-facing label naming the shot the product
 * is waiting for. So the rule is simply that the file must be there.
 */
const CATEGORY_ART_DIR = join(process.cwd(), 'public', 'categories');

describe('landing category art', () => {
  it('ships a photograph for every category the landing page draws', () => {
    const landing = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT);

    const missing = landing
      .map((category) => category.slug)
      .filter((slug) => !existsSync(join(CATEGORY_ART_DIR, `${slug}.jpg`)));

    expect(missing, `public/categories/<slug>.jpg missing for: ${missing.join(', ')}`).toEqual([]);
  });

  it('ships no photograph for a slug the taxonomy does not hold', () => {
    /*
     * The other direction, and it is narrower than it first looks.
     *
     * The obvious version — "every image belongs to a category the landing
     * draws" — was written first and was wrong. It forbids the ordinary
     * workflow: art is sourced for a category *before* the decision to promote
     * it, because promoting into a fixed six means choosing which one leaves.
     * `carts.jpg` landed 2026-09-06 under exactly that sequence and the guard
     * failed it, which is the test being wrong rather than the file.
     *
     * What is genuinely dead weight is art for a slug the taxonomy no longer
     * holds at all — a `florals.jpg` surviving #419, say. Nothing can ever
     * render it, and it will outlive everyone who remembers why it is there.
     */
    const known = new Set(CATEGORY_SEEDS.map((category) => category.slug));

    const orphaned = readdirSync(CATEGORY_ART_DIR)
      .filter((file) => file.endsWith('.jpg'))
      .map((file) => file.replace(/\.jpg$/, ''))
      .filter((slug) => !known.has(slug));

    expect(orphaned, `art for slugs no category holds: ${orphaned.join(', ')}`).toEqual([]);
  });
});
