import { cleanup, render, screen } from '@testing-library/react';
import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { VendorCard } from './vendor-card';

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

describe('VendorCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a complete decision unit', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByRole('heading', { name: 'Kessler & Co.' })).toBeDefined();
    expect(screen.getByText(/4\.9/)).toBeDefined();
    expect(screen.getByText(/Austin, TX/)).toBeDefined();
    expect(screen.getByText('Photography')).toBeDefined();
    expect(screen.getByText('$1,450')).toBeDefined();
  });

  it('links to the vendor profile', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByRole('link')).toHaveProperty(
      'href',
      'http://localhost:3000/vendors/kessler-co',
    );
  });

  /* Money is integer cents and only becomes a price at the display boundary. */
  it('renders the from-price without padded cents', () => {
    render(<VendorCard vendor={vendor({ startingPriceCents: 98_000 })} />);

    expect(screen.getByText('$980')).toBeDefined();
    expect(screen.queryByText('$980.00')).toBeNull();
  });

  it('says so plainly when a vendor has no price yet', () => {
    render(<VendorCard vendor={vendor({ startingPriceCents: null })} />);

    expect(screen.getByText('Contact for pricing')).toBeDefined();
    expect(screen.queryByText('From')).toBeNull();
  });

  /*
   * No invented numbers: an unreviewed vendor shows no rating rather than a
   * 0.0, which reads as a bad one.
   */
  it('shows no rating for an unreviewed vendor', () => {
    render(<VendorCard vendor={vendor({ avgRating: 0, reviewCount: 0 })} />);

    expect(screen.queryByText(/0\.0/)).toBeNull();
    expect(screen.getByText(/New/)).toBeDefined();
  });

  it('states the rating out of five for a screen reader, not just a star glyph', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByText(/out of 5, from 127 reviews/)).toBeDefined();
  });

  /*
   * When the query carried a date, the chip is the answer to the question the
   * customer actually asked.
   */
  it('answers the searched date with an availability chip', () => {
    render(<VendorCard vendor={vendor({ availableOnDate: true })} searchedDate="2026-06-14" />);

    expect(screen.getByText('Free June 14')).toBeDefined();
  });

  it('makes no availability claim when no date was searched', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.queryByText(/^Free /)).toBeNull();
  });

  it('falls back to a labelled placeholder when the vendor has no cover', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByRole('img', { name: 'Placeholder for cover 4:3' })).toBeDefined();
  });

  it('uses the vendor photograph when there is one', () => {
    render(<VendorCard vendor={vendor({ coverImageUrl: 'https://example.test/cover.jpg' })} />);

    expect(screen.queryByRole('img', { name: 'Placeholder for cover 4:3' })).toBeNull();
  });

  it('handles a vendor with no location without leaving a stray separator', () => {
    render(<VendorCard vendor={vendor({ city: null, state: null })} />);

    expect(screen.queryByText(/·\s*$/)).toBeNull();
  });
});
