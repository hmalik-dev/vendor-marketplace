import { existsSync } from 'node:fs';
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

  it('draws every category it ships a photograph for, so none is dead weight', () => {
    /*
     * The other direction. An image for a category the landing does not draw is
     * a file nobody renders — either the promotion was reverted and the art was
     * left behind, or the art was added in anticipation and the reorder never
     * happened. Both are worth surfacing; neither is a broken page.
     */
    const landingSlugs = new Set(
      CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT).map((category) => category.slug),
    );

    const unusedArt = CATEGORY_SEEDS.map((category) => category.slug)
      .filter((slug) => !landingSlugs.has(slug))
      .filter((slug) => existsSync(join(CATEGORY_ART_DIR, `${slug}.jpg`)));

    expect(unusedArt, `art exists but the landing never draws: ${unusedArt.join(', ')}`).toEqual(
      [],
    );
  });
});
