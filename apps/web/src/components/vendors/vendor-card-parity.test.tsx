import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { VendorCard } from './vendor-card';

/*
 * The search grid's card, measured against the frame that is its acceptance
 * criterion. Every expected value is read out of `02 Search` at test time
 * rather than written down here, so a design re-import that moves one fails
 * this file instead of passing silently — the rule
 * `type-scale-parity.test.ts` established for the type scale.
 */
const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** Frame `02 Search`, up to the frame that follows it. */
const searchFrame = (() => {
  const start = frameHtml.indexOf('data-screen-label="02 Search"');
  const next = frameHtml.indexOf('class="fr"', start);

  return frameHtml.slice(start, next === -1 ? undefined : next);
})();

/** The first vendor card the frame draws — every card in the grid repeats it. */
const frameCard = searchFrame.slice(searchFrame.indexOf('class="card"'));

/** One `property:value` out of an inline `style` attribute, as written. */
function styleValue(markup: string, property: string): string {
  const declaration = new RegExp(`[;"]${property}:([^;"]+)`).exec(markup);

  if (!declaration?.[1]) {
    throw new Error(`Frame 02 does not set \`${property}\``);
  }

  return declaration[1].trim();
}

function vendor(overrides: Partial<VendorCardData> = {}): VendorCardData {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    businessName: 'Kessler & Co.',
    slug: 'kessler-co',
    city: 'Austin',
    state: 'TX',
    profileImageUrl: null,
    coverImageUrl: null,
    avgRating: 4.9,
    reviewCount: 127,
    startingPriceCents: 145_000,
    categories: [{ id: 'cat-1', name: 'Photography', slug: 'photography' }],
    ...overrides,
  };
}

function card(): HTMLElement {
  const article = screen.getByRole('heading', { name: 'Kessler & Co.' }).closest('article');

  if (!article) {
    throw new Error('The card has no <article>');
  }

  return article;
}

describe('VendorCard parity with frame 02 Search', () => {
  afterEach(() => {
    cleanup();
  });

  it('rounds its corners to what the frame draws', () => {
    render(<VendorCard vendor={vendor()} density="compact" />);

    // `rounded-2xl` is 18px in the theme, which the frames do use elsewhere —
    // so the assertion is against the frame's own number, not against a token.
    expect(card().className).toContain(`rounded-[${styleValue(frameCard, 'border-radius')}]`);
  });
});
