import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@vendor-marketplace/shared';
import { AcceptedRequest } from './accepted-request';
import { ApiClientError } from '@/lib/api-client';
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
    vendor: {
      slug: 'kessler-co',
      businessName: 'Kessler & Co.',
      avatarUrl: null,
      availability: 'available',
    },
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
    fullRefundCutoffHours: 48,
    lateRefundRateBps: 5_000,
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

  /* VEN-559: a Pay link that leads straight to a refusal is a dead end. */
  it('explains a paused vendor instead of offering a Pay link, naming the deadline', () => {
    const request = acceptedRequest({
      expiresAt: new Date('2027-01-04T12:00:00Z'),
      vendor: {
        slug: 'kessler-co',
        businessName: 'Kessler & Co.',
        avatarUrl: null,
        availability: 'paused',
      },
    } as Partial<WireBookingRequest>);
    render(<AcceptedRequest request={request} booking={null} />);

    expect(screen.queryByRole('link', { name: /^Pay/ })).toBeNull();
    expect(screen.queryByText(/Paying now confirms it/)).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      "Kessler & Co. isn't taking bookings right now",
    );
    expect(screen.getByRole('status').textContent).toContain('expires in 3d');
  });

  it('says a closed vendor cannot be paid, permanently, with no Pay link', () => {
    const request = acceptedRequest({
      vendor: {
        slug: 'kessler-co',
        businessName: 'Kessler & Co.',
        avatarUrl: null,
        availability: 'closed',
      },
    } as Partial<WireBookingRequest>);
    render(<AcceptedRequest request={request} booking={null} />);

    expect(screen.queryByRole('link', { name: /^Pay/ })).toBeNull();
    expect(screen.queryByText(/Paying now confirms it/)).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('no longer taking bookings');
  });

  it('keeps the Pay link for an available vendor', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={null} />);

    expect(screen.getByRole('link', { name: 'Pay $1,450' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /** #412's seventh finding — the same summary line as `QuoteReview`. */
  it('writes the event date out rather than printing the ISO string', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={null} />);

    expect(screen.getByText('Wedding · June 14, 2027 · Barr Mansion, Austin, TX')).toBeDefined();
    expect(screen.queryByText(new RegExp(FAR_EVENT))).toBeNull();
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

    expect(
      screen.getByText(
        /^Cancel until Jun 12, 12:00\sAM UTC and you're refunded in full — \$1,450\. After that, until Jun 13, 12:00\sAM UTC, canceling refunds \$725\.$/,
      ),
    ).toBeDefined();
  });

  /*
   * VEN-615: the instants in the viewer's own zone. A Pacific customer's full
   * refund ends at 5 PM the evening before the UTC cutoff day — "more than 48
   * hours before the event" overstated it by the offset.
   */
  it('states the refund deadlines in the viewer time zone', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    try {
      render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

      expect(
        screen.getByText(/^Cancel until Jun 11, 5:00\sPM PDT and .* until Jun 12, 5:00\sPM PDT,/),
      ).toBeDefined();
      expect(screen.queryByText(/48 hours/)).toBeNull();
    } finally {
      process.env.TZ = previous;
    }
  });

  it('names the full-refund deadline before payment, as an instant', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={null} />);

    expect(
      screen.getByText(/refunded in full if you cancel by Jun 12, 12:00\sAM UTC\.$/),
    ).toBeDefined();
  });

  /* VEN-615 ruling 2: a vendor cannot cancel in the app, so the page says how they do. */
  it('says that if the vendor cancels the customer is refunded in full', () => {
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    expect(screen.getByText(/cancels, you're refunded in full\./)).toBeDefined();
  });

  it('names the halved refund once the event is inside the cutoff', () => {
    const soon = '2027-01-03';
    render(
      <AcceptedRequest
        request={acceptedRequest({ eventDate: soon })}
        booking={booking({ eventDate: soon })}
      />,
    );

    expect(
      screen.getByText(
        /^Canceling now refunds \$725 of \$1,450\. Online cancellation closes Jan 2, 12:00\sAM UTC\.$/,
      ),
    ).toBeDefined();
  });

  /*
   * VEN-647: the booking's own terms, not today's constants. A booking sold under
   * a 96-hour, 25% policy is quoted by it three days out, where today's 48 hours
   * would still refund in full.
   */
  it('quotes the refund by the terms the booking was sold under', () => {
    const threeDaysOut = '2027-01-04';
    render(
      <AcceptedRequest
        request={acceptedRequest({ eventDate: threeDaysOut })}
        booking={booking({
          eventDate: threeDaysOut,
          fullRefundCutoffHours: 96,
          lateRefundRateBps: 2_500,
        })}
      />,
    );

    expect(screen.getByText(/^Canceling now refunds \$362\.50 of \$1,450\./)).toBeDefined();
  });

  /*
   * The API refuses a cancellation once the event has started or the vendor has
   * been paid, so the control must not be offered to be refused.
   */
  it.each([
    ['the event is too close', { eventDate: '2027-01-02' }],
    ['the payout has been released', { payoutReleasedAt: new Date('2027-01-01T00:00:00Z') }],
  ])('offers no cancel control once %s', (_case, overrides) => {
    render(
      <AcceptedRequest
        request={acceptedRequest({ eventDate: '2027-01-01' })}
        booking={booking({ payoutReleasedAt: null, ...overrides })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.queryByText(/refunded in full|refunds \$/)).toBeNull();
    expect(screen.getByText(/can no longer be canceled here/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'View confirmation' })).toBeDefined();
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
        // The amount on the button is the amount the server is asked to honour (VEN-425).
        body: { expectedRefundCents: 145_000 },
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
  });

  /*
   * #405. This rendered `ApiClientError.message` verbatim, so a 500 on the
   * money path put `Internal server error` in the alert — one of the shapes
   * `user-facing-error.ts` pins as never-shown, and neither half of what
   * `40-states.md` asks an error to say.
   */
  it('does not print the API’s own words for a server failure', async () => {
    requestMock.mockRejectedValue(
      new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
    );
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(screen.getByRole('button', { name: /^Yes, cancel/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('That did not reach us. Check your connection and try again.');
    expect(alert.textContent).not.toContain('Internal server error');
  });

  /*
   * #405. The refund may already have been issued and the row cancelled when
   * the client cannot parse the answer — a schema drift. Skipping the refresh
   * left the customer looking at a live booking and a `Cancel` button for
   * something that no longer existed, so it now runs whichever way it went.
   */
  it('re-reads the booking even when the cancellation appeared to fail', async () => {
    requestMock.mockRejectedValue(new Error('schema drift'));
    render(<AcceptedRequest request={acceptedRequest()} booking={booking()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(screen.getByRole('button', { name: /^Yes, cancel/ }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
