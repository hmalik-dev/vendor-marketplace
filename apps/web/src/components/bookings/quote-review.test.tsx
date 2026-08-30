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
   */
  it('cannot accept a custom request that has not been quoted yet', () => {
    render(
      <QuoteReview
        request={quotedRequest({ status: 'pending', quotedPriceCents: null, quoteNote: null })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Accept quote' })).toHaveProperty('disabled', true);
    expect(screen.getByText('No price yet')).toBeDefined();
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
