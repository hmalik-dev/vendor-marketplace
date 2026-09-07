import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { StorefrontPreview } from './storefront-preview';

/*
 * The storefront editor's mirror — what a customer will see. That is precisely
 * why a cover whose stored object has gone must not draw a broken-image glyph
 * here (#422): the vendor would read the *preview* as broken and go looking for
 * a bug in the editor, when what is actually gone is their photograph.
 *
 * jsdom fetches nothing, so `fireEvent.error` stands in for the browser's own
 * event; `e2e/image-fallback.spec.ts` drives a real 404 in Chromium.
 */
function vendor(overrides: Partial<VendorCardData> = {}): VendorCardData {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    businessName: 'Kessler & Co.',
    slug: 'kessler-co',
    city: 'Austin',
    state: 'TX',
    profileImageUrl: null,
    coverImageUrl: 'https://example.test/gone.jpg',
    avgRating: 4.9,
    reviewCount: 127,
    startingPriceCents: 145_000,
    isNew: false,
    categories: [{ id: 'cat-1', name: 'Photography', slug: 'photography' }],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('StorefrontPreview', () => {
  it('grounds a search-card cover that fails to load, with nothing inside it', () => {
    const { container } = render(<StorefrontPreview vendor={vendor()} />);

    fireEvent.error(container.querySelector('img[src*="gone.jpg"]')!);

    const block = container.querySelector('[data-slot="image-fallback"]');

    expect(container.querySelector('img[src*="gone.jpg"]')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    expect(block?.textContent).toBe('');
  });

  it('grounds the profile placement the same way', async () => {
    const { container } = render(<StorefrontPreview vendor={vendor()} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Your profile' }));

    fireEvent.error(container.querySelector('img[src*="gone.jpg"]')!);

    const block = container.querySelector('[data-slot="image-fallback"]');

    expect(container.querySelector('img[src*="gone.jpg"]')).toBeNull();
    expect(block?.className).toContain('bg-stone-250');
    /*
     * The 3:2 box is on the wrapper, so a failed cover leaves the placement
     * exactly the height it had. jsdom performs no layout — this is the
     * class-level fact, measured for real in the e2e spec.
     */
    expect(block?.parentElement?.className).toContain('aspect-3/2');
  });
});
