import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoCluster } from './photo-cluster';

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
    categories: [],
    ...overrides,
  };
}

describe('PhotoCluster', () => {
  afterEach(() => {
    cleanup();
  });

  it('labels every placeholder with the shot it is waiting for', () => {
    render(<PhotoCluster />);

    for (const label of ['florist / tablescape', 'photographer / portrait', 'dj / dance floor']) {
      expect(screen.getByRole('img', { name: `Placeholder for ${label}` }), label).toBeDefined();
    }
  });

  it('names a vendor who actually exists on the chip', () => {
    render(<PhotoCluster vendor={vendor()} />);

    expect(screen.getByText('Kessler & Co.')).toBeDefined();
    expect(screen.getByText(/4\.9/)).toBeDefined();
    expect(screen.getByText(/Austin, TX/)).toBeDefined();
  });

  it('shows no rating at all for an unreviewed vendor, never a 0.0', () => {
    render(<PhotoCluster vendor={vendor({ avgRating: 0, reviewCount: 0 })} />);

    expect(screen.getByText('Austin, TX')).toBeDefined();
    expect(screen.queryByText(/0\.0/)).toBeNull();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('drops the chip rather than inventing a vendor for it', () => {
    render(<PhotoCluster />);

    expect(screen.queryByText(/★/)).toBeNull();
    expect(screen.queryByText('Kessler & Co.')).toBeNull();
  });
});
