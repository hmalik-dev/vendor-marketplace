import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REVIEW_PAGE_SIZE } from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsPane } from './reviews-pane';
import type { WirePublicReview, WireVendorReviewsPage } from '@/lib/wire-schemas';

// The formatter is built at import, so the zone must be set before the imports run.
const originalTz = vi.hoisted(() => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  return previous;
});

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});
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

const BASE = { slug: 'june-harlow', businessName: 'June Harlow', signedIn: true };

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

  it('dates a review to its UTC day for a reader west of UTC, with no hydration warning', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({ items: [review({ createdAt: new Date('2026-09-14T03:00:00.000Z') })] })}
      />,
    );

    expect(screen.getByText('September 14, 2026')).toBeDefined();
    expect(screen.queryByText('September 13, 2026')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
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
        "We couldn't reach the server. Check your connection and try again.",
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
   * are server-rendered from the same numbers this pane shows, so the whole
   * route is still refreshed. But the pane does not wait on that refresh to
   * show the author their review: CI saw `router.refresh()` answer and never
   * commit (VEN-779, VEN-781), leaving the tab without the review it had just
   * posted. The pane re-reads its own first page, as `showMore` reads the next.
   */
  async function postReview(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Write a review' }));

    const form = screen.getByRole('form', { name: 'How was your experience?' });
    await user.click(within(form).getByRole('radio', { name: /^5 stars/ }));
    await user.type(
      within(form).getByLabelText('Review'),
      'They were unhurried and the pictures show it.',
    );
    await user.click(within(form).getByRole('button', { name: 'Post review' }));
  }

  it('shows the filed review from its own re-read, and refreshes the route', async () => {
    const user = userEvent.setup();
    requestMock.mockImplementation((_path: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method === 'POST'
          ? { id: 'rev-new' }
          : payload({
              items: [review({ id: 'rev-new', reviewerName: 'You', title: 'Superb' })],
              summary: { avgRating: 5, reviewCount: 3, distribution: [0, 0, 0, 0, 3] },
              viewer: { canReview: false, bookingId: null },
            }),
      ),
    );

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />);
    expect(screen.getByText('2 reviews')).toBeDefined();
    await postReview(user);

    // `initial` never changed: the refresh is mocked and commits nothing.
    expect(await screen.findByText('Superb')).toBeDefined();
    expect(screen.getByText('3 reviews')).toBeDefined();
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write a review' })).toBeNull();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock.mock.calls[1]?.[0]).toBe('/vendors/june-harlow/reviews');
  });

  it('closes the form without an error when the re-read fails', async () => {
    const user = userEvent.setup();
    requestMock.mockImplementation((_path: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? Promise.resolve({ id: 'rev-new' })
        : Promise.reject(new TypeError('Failed to fetch')),
    );

    render(<ReviewsPane {...BASE} reviewCount={2} initial={payload({ viewer: eligible })} />);
    await postReview(user);

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.getByText('2 reviews')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
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

/**
 * The report control on a review (#436).
 *
 * Here rather than only in the browser because the seeded E2E storefront has
 * no reviews, so a browser pass over the four reportable subjects can drive
 * three of them and reads the fourth as "no control" — indistinguishable from
 * the control being absent. The other three are browser-verified; this is the
 * one that needs a fixture with a review in it, and a render test is the
 * cheapest place to get one.
 */
describe('ReviewsPane — reporting a review', () => {
  it('offers a report control per review, not one for the tab', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          items: [review({ id: 'rev-1' }), review({ id: 'rev-2', reviewerName: 'Sam O.' })],
        })}
      />,
    );

    /* A report names a row, so two reviews carry two controls. */
    expect(screen.getAllByRole('button', { name: 'Report this review' })).toHaveLength(2);
  });

  /*
   * Reporting is authenticated, so a signed-out reader is offered the thing
   * that would let them do it rather than a form that can only fail.
   */
  it('sends a signed-out reader to sign in instead', () => {
    render(<ReviewsPane {...BASE} signedIn={false} reviewCount={2} initial={payload()} />);

    expect(screen.queryByRole('button', { name: 'Report this review' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Sign in to report this review' }).getAttribute('href'),
    ).toBe('/sign-in');
  });

  /*
   * #458 narrowed here, and the distinction is pinned at the page rather than
   * in this file — see `who the storefront offers a report control to` in
   * `app/vendors/[slug]/page.test.tsx`, which drives the owning vendor through
   * the real `ReviewsPane`.
   *
   * The About and Portfolio panes stop offering their controls to the vendor
   * who owns the storefront, because those subjects are the vendor's own
   * record and reporting one is self-reporting. **A review is not.** A
   * customer wrote it about them, and a vendor objecting to a defamatory or
   * extortionate review is the ordinary use of the control rather than the
   * noise #458 removes — and it is their only route, because there is no
   * vendor-side reviews surface anywhere in `apps/web/src/app/vendor/`.
   *
   * An earlier version of this test asserted `Object.keys(BASE)` did not
   * contain `viewerOwnsProfile`, which was a guard on the fixture beside it:
   * adding an optional prop to `ReviewsPane` and passing it from the page
   * would have left `BASE` untouched and this file green. A guard on the
   * literal it lives next to cannot fail for a change made anywhere else.
   */
  it('offers one control per review to a signed-in reader, whoever they are', () => {
    render(
      <ReviewsPane
        {...BASE}
        reviewCount={2}
        initial={payload({
          items: [review({ id: 'rev-1' }), review({ id: 'rev-2', reviewerName: 'Sam O.' })],
        })}
      />,
    );

    expect(screen.getAllByText('Sam O.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Report this review' })).toHaveLength(2);
  });
});
