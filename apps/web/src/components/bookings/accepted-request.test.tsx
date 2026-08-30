import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptedRequest } from './accepted-request';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

/** Far enough out that a cancellation is outside the 48-hour cutoff. */
const FAR_EVENT = '2027-06-14';
/** The day the suite pretends it is, so the cutoff is not read off the wall. */
const NOW = new Date('2027-01-01T12:00:00Z');

function acceptedRequest(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    status: 'accepted',
    eventDate: FAR_EVENT,
    eventType: 'wedding',
    eventLocation: 'Barr Mansion, Austin, TX',
    finalPriceCents: 145_000,
    quotedPriceCents: null,
    quoteNote: null,
    expiresAt: null,
    vendor: { slug: 'kessler-co', businessName: 'Kessler & Co.', avatarUrl: null },
    ...overrides,
  } as unknown as WireBookingRequest;
}

function booking(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'bkg-1',
    requestId: 'req-1',
    eventDate: FAR_EVENT,
    totalAmountCents: 145_000,
    status: 'confirmed',
    ...overrides,
  } as unknown as WireBooking;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
  refreshMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/*
 * #10. `QuoteReview` explicitly handed this state over — "Accepted → Pay now is
 * the state this hands over to" — and until checkout existed there was nothing
 * to hand it to. An accepted request rendered the quote surface, headed
 * "…sent a quote", offering Accept on a quote already accepted.
 */
describe('AcceptedRequest', () => {
  it('offers the price and a route to checkout before payment', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={null} />);

    expect(screen.getByRole('heading').textContent).toBe('Kessler & Co. accepted your request');
    const pay = screen.getByRole('link', { name: 'Pay $1,450' });
    expect(pay.getAttribute('href')).toBe('/bookings/req-1/checkout');
    // Nothing is cancellable before there is a payment to refund.
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  });

  it('becomes the booking once it is paid for', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    expect(screen.getByRole('heading').textContent).toBe('Kessler & Co. is booked');
    expect(screen.getByText('Paid')).toBeDefined();
    expect(screen.queryByRole('link', { name: /^Pay / })).toBeNull();
  });

  /*
   * The refund is stated before the click, not after it. A customer who learns
   * the refund is half only from the confirmation has been told too late — and
   * the figure comes from the same helper the API refunds by, so the two cannot
   * quote different numbers.
   */
  it('names the full refund while the event is far off', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    expect(screen.getByText(/refunded in full — \$1,450\./)).toBeDefined();
  });

  it('names the halved refund once the event is inside the cutoff', () => {
    const soon = '2027-01-02';
    render(
      <AcceptedRequest
        request={acceptedRequest({ eventDate: soon })}
        booking={booking({ eventDate: soon })}
      />,
    );

    expect(screen.getByText(/refunds \$725 of \$1,450\./)).toBeDefined();
  });

  /* A destructive action takes two deliberate presses, and names the amount. */
  it('confirms before cancelling, and sends the cancellation once', async () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(requestMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel and refund $1,450' }));

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('/customer/bookings/bkg-1/cancel', {
        method: 'PUT',
        body: {},
        schema: expect.anything(),
      });
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('backs out of the confirmation without cancelling', async () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep the booking' }));

    expect(requestMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeDefined();
  });

  /*
   * `40-states.md`: the failure is named beside the control, in the reader's
   * words, with one thing to do.
   */
  it('names a failed cancellation rather than leaving it silent', async () => {
    requestMock.mockRejectedValue(new Error('offline'));
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(screen.getByRole('button', { name: /^Yes, cancel/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('That did not reach us. Check your connection and try again.');
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
