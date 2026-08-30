import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteReview } from './quote-review';
import type { WireBookingRequest } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

function quotedRequest(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    status: 'quoted',
    quotedPriceCents: 384_000,
    finalPriceCents: null,
    quoteNote: 'Includes travel to Barr Mansion and a second shooter.',
    eventDate: '2026-06-14',
    eventType: 'wedding',
    eventLocation: 'Barr Mansion, Austin, TX',
    expiresAt: null,
    vendor: { slug: 'kessler-and-co', businessName: 'Kessler & Co.', avatarUrl: null },
    ...overrides,
  } as unknown as WireBookingRequest;
}

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
  refreshMock.mockReset();
});

afterEach(cleanup);

/*
 * The surface that did not exist. `Review quote` — on the hub, in its rail and
 * in the customer's own notification — pointed at the vendor's storefront,
 * whose only controls are `Request booking` and `Send a message`. The API had
 * supported accept and decline the whole time and nothing reached them.
 */
describe('QuoteReview', () => {
  it('names the vendor and shows the quoted price', () => {
    render(<QuoteReview request={quotedRequest()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Kessler & Co. sent a quote' }),
    ).toBeDefined();
    expect(screen.getByText('$3,840')).toBeDefined();
    expect(screen.getByText('Includes travel to Barr Mansion and a second shooter.')).toBeDefined();
  });

  it('accepts the quote through the API and re-reads from the server', async () => {
    render(<QuoteReview request={quotedRequest()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Accept quote' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/booking-requests/req-1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it('declines through the API', async () => {
    render(<QuoteReview request={quotedRequest()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/booking-requests/req-1/decline',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /*
   * The terms belong before the click. The cutoff is read from the constant
   * rather than written out, for the same reason the request deadline is — a
   * literal here is a promise nothing keeps in sync.
   */
  it('states the cancellation terms before the action, from the constant', async () => {
    const { FULL_REFUND_CUTOFF_HOURS } = await import('@vendor-marketplace/shared');
    render(<QuoteReview request={quotedRequest()} />);

    expect(
      screen.getByText(
        new RegExp(`full refund applies if you cancel at least ${FULL_REFUND_CUTOFF_HOURS} hours`),
      ),
    ).toBeDefined();
  });

  /* Nothing on this surface charges anything — paying is #10's. */
  it('offers no checkout', () => {
    render(<QuoteReview request={quotedRequest()} />);

    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /pay/i })).toBeNull();
  });

  /*
   * A **custom** request, which is the only shape that actually reaches this
   * surface without a price. `createBookingRequest` writes
   * `finalPriceCents: servicePackage?.priceCents ?? null`, so a packaged
   * request is priced from the moment it exists, and the quote path always
   * writes `quotedPriceCents` — meaning a `quoted` request with no price is a
   * row the application cannot produce.
   *
   * This originally asserted against exactly that impossible row: `quoted`
   * with a null price. Every field was checked and the object described could
   * not exist, which no assertion on values can see.
   *
   * #309 then found the assertion itself was pinning a broken screen. A
   * `pending` request rendered a **disabled** `Accept quote` above the words
   * "No price yet" — a field pretending to be a value, and a control offered
   * for a decision nobody has put to the customer. There is nothing to accept
   * before a quote exists, so the screen offers nothing to accept.
   */
  it('offers nothing to accept before the vendor has quoted', () => {
    render(
      <QuoteReview
        request={quotedRequest({ status: 'pending', quotedPriceCents: null, quoteNote: null })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Accept quote' })).toBeNull();
    expect(screen.queryByText('No price yet')).toBeNull();
    expect(screen.queryByText('Quoted price')).toBeNull();
  });

  /*
   * #309 / #214. `POST /booking-requests/:id/cancel` had existed the whole
   * time and nothing on any customer surface reached it, so a request sent to
   * a vendor who never answered could not be taken back.
   *
   * The word is the product's own: the hub renders a cancelled *request* as
   * "Withdrawn", separately from a cancelled *booking*'s "Cancelled".
   */
  describe('withdrawing a request the vendor has not answered', () => {
    it('names the state honestly rather than claiming a quote arrived', () => {
      render(
        <QuoteReview request={quotedRequest({ status: 'pending', quotedPriceCents: null })} />,
      );

      expect(screen.getByRole('heading', { name: /Waiting on/ })).toBeDefined();
      expect(screen.queryByText(/sent a quote/)).toBeNull();
    });

    /* Destructive, so it takes a deliberate second press rather than one. */
    it('asks twice before withdrawing', async () => {
      render(
        <QuoteReview request={quotedRequest({ status: 'pending', quotedPriceCents: null })} />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));

      expect(requestMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Yes, withdraw it' })).toBeDefined();
    });

    it('withdraws through the API on the second press', async () => {
      render(
        <QuoteReview request={quotedRequest({ status: 'pending', quotedPriceCents: null })} />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));
      await userEvent.click(screen.getByRole('button', { name: 'Yes, withdraw it' }));

      expect(requestMock).toHaveBeenCalledWith(
        '/booking-requests/req-1/cancel',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('lets the customer back out of withdrawing', async () => {
      render(
        <QuoteReview request={quotedRequest({ status: 'pending', quotedPriceCents: null })} />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));
      await userEvent.click(screen.getByRole('button', { name: 'Keep waiting' }));

      expect(requestMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeDefined();
    });

    /*
     * Withdrawing belongs to the unanswered state. Once a price is on the
     * table the customer's "no" is `Decline`, and two controls that both end
     * the request would be two names for one thing.
     */
    it('is absent once a quote is on the table', () => {
      render(<QuoteReview request={quotedRequest({ status: 'quoted' })} />);

      expect(screen.queryByRole('button', { name: 'Withdraw request' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Decline' })).toBeDefined();
    });
  });

  it('shows a failure inline rather than losing it', async () => {
    const { ApiClientError } = await import('@/lib/api-client');
    requestMock.mockRejectedValue(
      new ApiClientError(409, 'CONFLICT', 'That date was booked while this quote was open'),
    );
    render(<QuoteReview request={quotedRequest()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Accept quote' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('That date was booked while this quote was open');
  });
});
