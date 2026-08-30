import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REVIEW_PAGE_SIZE } from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsPane } from './reviews-pane';
import type { WirePublicReview, WireVendorReviewsPage } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

afterEach(cleanup);
beforeEach(() => {
  requestMock.mockReset();
  refreshMock.mockReset();
});

function review(overrides: Partial<WirePublicReview> = {}): WirePublicReview {
  return {
    id: 'rev-1',
    rating: 5,
    title: 'Worth every penny',
    content: 'They caught the whole day without ever getting in the way of it.',
    reviewerName: 'Priya M.',
    eventType: 'wedding',
    createdAt: new Date('2026-06-20T12:00:00Z'),
    ...overrides,
  };
}

function payload(overrides: Partial<WireVendorReviewsPage> = {}): WireVendorReviewsPage {
  return {
    items: [review()],
    summary: { avgRating: 4.5, reviewCount: 2, distribution: [0, 0, 0, 1, 1] },
    viewer: { canReview: false, bookingId: null },
    page: 1,
    pageSize: REVIEW_PAGE_SIZE,
    hasMore: false,
    ...overrides,
  };
}

const BASE = { slug: 'june-harlow', businessName: 'June Harlow' };

describe('ReviewsPane — the summary', () => {
  it('renders the average, the count and the five-bar distribution', () => {
    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload()} />);

    expect(screen.getByText('4.5')).toBeDefined();
    expect(screen.getByText('2 reviews')).toBeDefined();

    // Five bars, one per rating, highest first — never four and never six.
    const bars = screen.getAllByRole('listitem').slice(0, 5);
    expect(bars.map((bar) => bar.textContent)).toEqual(['5★1', '4★1', '3★0', '2★0', '1★0']);
  });

  /*
   * Widths are relative to the biggest bucket, not the total. Against the total
   * a lone one-star bar beside thirty fives is indistinguishable from empty,
   * and the shape of the distribution is the only thing the chart adds.
   */
  it('scales the bars against the fullest bucket', () => {
    const { container } = render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          summary: { avgRating: 4.9, reviewCount: 32, distribution: [2, 0, 0, 0, 30] },
        })}
      />,
    );

    const widths = [...container.querySelectorAll<HTMLElement>('.bg-clay-400')].map(
      (bar) => bar.style.width,
    );

    expect(widths[0]).toBe('100%');
    expect(widths[4]).toBe(`${(2 / 30) * 100}%`);
  });

  /*
   * Found in the browser: the glyphs round to five, and the spoken text used to
   * round with them — so a screen-reader user was told "5 out of 5" beside a
   * printed 4.9. A wrong number, confidently, and only for them.
   */
  it('speaks the average it prints, not the number of filled stars', () => {
    // No cards, so every spoken rating on screen belongs to the summary.
    const { container } = render(
      <ReviewsPane {...BASE} reviewCount={2} initial={payload({ items: [] })} />,
    );

    const spoken = [...container.querySelectorAll('.sr-only')].map((node) => node.textContent);
    expect(spoken).toContain('4.5 out of 5 stars');
    expect(spoken).not.toContain('5 out of 5 stars');
  });

  it('speaks a whole rating without a decimal point', () => {
    const { container } = render(<ReviewsPane {...BASE} reviewCount={2} initial={payload()} />);

    // The card below the summary is a flat 5, and reads as one.
    expect([...container.querySelectorAll('.sr-only')].map((node) => node.textContent)).toContain(
      '5 out of 5 stars',
    );
  });

  it('says “1 review” rather than “1 reviews”', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          summary: { avgRating: 5, reviewCount: 1, distribution: [0, 0, 0, 0, 1] },
        })}
      />,
    );

    expect(screen.getByText('1 review')).toBeDefined();
  });
});

describe('ReviewsPane — the cards', () => {
  it('names the reviewer by first name and initial, with a dated event badge', () => {
    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload()} />);

    expect(screen.getByText('Priya M.')).toBeDefined();
    expect(screen.getByText('Worth every penny')).toBeDefined();
    expect(screen.getByText('June 20, 2026')).toBeDefined();
    expect(screen.getByText('Wedding')).toBeDefined();
  });

  it('draws no badge for a booking with no event type', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({ items: [review({ eventType: null })] })}
      />,
    );

    expect(screen.queryByText('Wedding')).toBeNull();
  });

  it('renders the empty state when the vendor has no reviews', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          items: [],
          summary: { avgRating: null, reviewCount: 0, distribution: [0, 0, 0, 0, 0] },
        })}
      />,
    );

    expect(screen.getByText('No reviews yet')).toBeDefined();
    expect(screen.getByText(/comes from a completed booking/)).toBeDefined();
  });

  /*
   * The two states a failed read can land in, and the vendor's own count is the
   * only thing that tells them apart. Saying "no reviews yet" about a vendor
   * with 127 of them — under a header still showing that number — is a false
   * claim about the vendor, not a smaller kind of error.
   */
  it('says the reviews are on their way when a vendor with some cannot be read', () => {
    render(<ReviewsPane {...BASE} reviewCount={127} initial={null} />);

    expect(screen.getByText('Reviews are on their way')).toBeDefined();
    expect(screen.getByText(/June Harlow has 127 reviews/)).toBeDefined();
    expect(screen.queryByText('No reviews yet')).toBeNull();
  });

  it('says there are none when the vendor genuinely has none', () => {
    render(<ReviewsPane {...BASE} reviewCount={0} initial={null} />);

    expect(screen.getByText('No reviews yet')).toBeDefined();
    expect(screen.queryByText('Reviews are on their way')).toBeNull();
  });
});

describe('ReviewsPane — showing more', () => {
  it('appends the next page and never draws page numbers', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue(
      payload({
        items: [review({ id: 'rev-2', reviewerName: 'Dan T.' })],
        page: 2,
        hasMore: false,
      }),
    );

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ hasMore: true })} />);

    await user.click(screen.getByRole('button', { name: 'Show more reviews' }));

    await waitFor(() => expect(screen.getByText('Dan T.')).toBeDefined());
    // Appended: the first page is still on screen.
    expect(screen.getByText('Priya M.')).toBeDefined();
    expect(requestMock).toHaveBeenCalledWith('/vendors/june-harlow/reviews?page=2', {
      schema: expect.anything(),
    });
    // The button is gone because there is no more, and no pager replaced it.
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  /*
   * A review filed while someone reads pushes the list down by one, so page 2
   * can repeat page 1's last row. A duplicate React key is an error, not a
   * cosmetic repeat.
   */
  it('drops a row the next page repeats', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue(payload({ items: [review()], page: 2, hasMore: false }));

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ hasMore: true })} />);
    await user.click(screen.getByRole('button', { name: 'Show more reviews' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull(),
    );
    expect(screen.getAllByText('Priya M.')).toHaveLength(1);
  });

  it('says so in the reader’s words when the next page fails', async () => {
    const user = userEvent.setup();
    requestMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ hasMore: true })} />);
    await user.click(screen.getByRole('button', { name: 'Show more reviews' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'We couldn’t reach the server. Check your connection and try again.',
      ),
    );
  });
});

describe('ReviewsPane — writing one', () => {
  const eligible = { canReview: true, bookingId: 'bkg-1' };

  it('offers the write action only to a viewer with an unreviewed booking', () => {
    const { unmount } = render(<ReviewsPane {...BASE} reviewCount={2} initial={payload()} />);
    expect(screen.queryByRole('button', { name: 'Write a review' })).toBeNull();
    unmount();

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />);
    expect(screen.getByRole('button', { name: 'Write a review' })).toBeDefined();
  });

  it('offers it on the empty state too, so the first review has a way in', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          items: [],
          summary: { avgRating: null, reviewCount: 0, distribution: [0, 0, 0, 0, 0] },
          viewer: eligible,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Write a review' })).toBeDefined();
  });

  it('opens the form under the prompt the voice table names', async () => {
    const user = userEvent.setup();
    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />);

    await user.click(screen.getByRole('button', { name: 'Write a review' }));

    expect(screen.getByRole('heading', { name: 'How was your experience?' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: /create review/i })).toBeNull();
  });

  /*
   * The header's rating line and the rail's "N reviews from verified bookings"
   * are server-rendered from the same numbers this pane shows. Updating only
   * what this component can reach put three counts on one screen, two of them
   * wrong — observed in the browser, so the whole route is refreshed instead.
   */
  it('refreshes the whole route once the review is filed', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({ id: 'rev-new' });

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />);
    await user.click(screen.getByRole('button', { name: 'Write a review' }));

    const form = screen.getByRole('form', { name: 'How was your experience?' });
    await user.click(within(form).getByRole('radio', { name: /^5 stars/ }));
    await user.type(
      within(form).getByLabelText('Review'),
      'They were unhurried and the pictures show it.',
    );
    await user.click(within(form).getByRole('button', { name: 'Post review' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    // The form closed, and nothing was re-fetched from here: the refresh is
    // what brings the new numbers back, as a fresh `initial`.
    expect(screen.queryByRole('form')).toBeNull();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  /* What the refresh above delivers: a new `initial`, which must land. */
  it('re-seeds the summary and the list from a fresh server read', () => {
    const { rerender } = render(
      <ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />,
    );
    expect(screen.getByText('2 reviews')).toBeDefined();

    rerender(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          items: [review({ id: 'rev-new', reviewerName: 'You', title: 'Superb' })],
          summary: { avgRating: 5, reviewCount: 3, distribution: [0, 0, 0, 0, 3] },
          viewer: { canReview: false, bookingId: null },
        })}
      />,
    );

    expect(screen.getByText('3 reviews')).toBeDefined();
    expect(screen.getByText('Superb')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Write a review' })).toBeNull();
  });
});
