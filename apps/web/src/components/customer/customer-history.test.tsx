import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CustomerReviews } from './customer-history';
import type { WireCustomerReview } from '@/lib/wire-schemas';

afterEach(cleanup);

describe('CustomerReviews', () => {
  it('uses the specified empty copy when no vendor has reviewed them', () => {
    render(<CustomerReviews reviews={[]} />);

    expect(
      screen.getByText('Reviews from vendors will appear here after completed events.'),
    ).toBeDefined();
  });

  it('credits the business, never the reviewer as a person', () => {
    const review: WireCustomerReview = {
      id: 'rev-1',
      rating: 5,
      title: null,
      content: 'Clear about what they wanted and ready on the day.',
      vendorBusinessName: 'June Harlow',
      createdAt: new Date('2026-08-28'),
    };

    render(<CustomerReviews reviews={[review]} />);

    expect(screen.getByText('June Harlow')).toBeDefined();
    expect(screen.getByText('Clear about what they wanted and ready on the day.')).toBeDefined();
  });
});
