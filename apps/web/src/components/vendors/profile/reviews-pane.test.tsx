import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireVendorReviewsPage } from '@/lib/wire-schemas';
import { ReviewsPane } from './reviews-pane';

const { requestMock, refreshMock, apiRequestMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  refreshMock: vi.fn(),
  apiRequestMock: vi.fn(),
}));

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, apiRequest: apiRequestMock };
});

function review(overrides: Partial<WireVendorReviewsPage['items'][number]> = {}) {
  return {
    id: 'review-1',
    rating: 5,
    title: 'Fantastic day',
    content: 'Everything about working with them was easy and warm.',
    reviewerFirstName: 'Alan',
    reviewerLastInitial: 'T',
    eventType: 'wedding',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  };
}

function pageOf(
  items: WireVendorReviewsPage['items'],
  overrides: Partial<WireVendorReviewsPage> = {},
): WireVendorReviewsPage {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 10,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: items.length },
    ...overrides,
  };
}

beforeEach(() => {
  requestMock.mockReset();
  refreshMock.mockReset();
  apiRequestMock.mockReset();
});

afterEach(cleanup);

describe('ReviewsPane', () => {
  it('shows the empty state when there are no reviews, with no CTA for an ineligible reader', () => {
    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={0}
        reviewCount={0}
        initialPage={pageOf([])}
        eligibility={{ eligible: false, bookingId: null }}
      />,
    );

    expect(screen.getByText('No reviews yet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Write a review' })).toBeNull();
  });

  it('shows "Write a review" only when the reader is eligible', () => {
    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={5}
        reviewCount={1}
        initialPage={pageOf([review()])}
        eligibility={{ eligible: true, bookingId: 'booking-1' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Write a review' })).toBeDefined();
  });

  it('renders the overall rating, the review card content and the event badge', () => {
    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={4.6}
        reviewCount={1}
        initialPage={pageOf([review()])}
        eligibility={{ eligible: false, bookingId: null }}
      />,
    );

    expect(screen.getByText('4.6')).toBeDefined();
    expect(screen.getByText('1 review')).toBeDefined();
    expect(screen.getByText('Alan T.')).toBeDefined();
    expect(screen.getByText('Fantastic day')).toBeDefined();
    expect(screen.getByText('Everything about working with them was easy and warm.')).toBeDefined();
    expect(screen.getByText('Wedding')).toBeDefined();
  });

  it('never renders page numbers', () => {
    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={5}
        reviewCount={12}
        initialPage={pageOf(
          Array.from({ length: 10 }, (_, index) => review({ id: `review-${index}` })),
          { total: 12 },
        )}
        eligibility={{ eligible: false, bookingId: null }}
      />,
    );

    expect(screen.queryByRole('navigation', { name: /page/i })).toBeNull();
    expect(screen.queryByText('1', { selector: 'button, a' })).toBeNull();
  });

  it('"Show more reviews" appends the next page rather than replacing it', async () => {
    const firstTen = Array.from({ length: 10 }, (_, index) =>
      review({ id: `review-${index}`, title: `Review number ${index}` }),
    );
    apiRequestMock.mockResolvedValue(
      pageOf([review({ id: 'review-11', title: 'The eleventh review' })], {
        page: 2,
        total: 11,
      }),
    );

    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={5}
        reviewCount={11}
        initialPage={pageOf(firstTen, { total: 11 })}
        eligibility={{ eligible: false, bookingId: null }}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(10);

    await userEvent.click(screen.getByRole('button', { name: 'Show more reviews' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(11));
    // The first ten are still there — appended, not replaced.
    expect(screen.getByText('Review number 0')).toBeDefined();
    expect(screen.getByText('The eleventh review')).toBeDefined();

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/vendors/sunlit-studio/reviews?page=2&limit=10',
      expect.objectContaining({}),
    );
  });

  it('hides "Show more reviews" once every review has loaded', () => {
    render(
      <ReviewsPane
        slug="sunlit-studio"
        businessName="Sunlit Studio"
        avgRating={5}
        reviewCount={1}
        initialPage={pageOf([review()], { total: 1 })}
        eligibility={{ eligible: false, bookingId: null }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull();
  });
});
