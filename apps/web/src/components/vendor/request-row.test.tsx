import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireBookingRequest } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RequestRow } = await import('./request-row');

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  refresh.mockReset();
});

function booking(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2026-06-14',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    customDetails: null,
    status: 'pending',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 145_000,
    expiresAt: new Date(Date.now() + 42 * 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      firstName: 'Priya',
      lastInitial: 'N',
      // Withheld until the request is accepted — the row never shows these.
      lastName: null,
      email: null,
      phone: null,
    },
    vendor: {
      id: 'ven-1',
      slug: 'kessler-co',
      businessName: 'Kessler & Co.',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: {
      id: 'pkg-1',
      name: 'Full day coverage',
      priceCents: 145_000,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    },
    ...overrides,
  } as WireBookingRequest;
}

describe('RequestRow', () => {
  /* Never the id, and never the full name before the vendor has accepted. */
  it('names the sender as a first name and an initial', () => {
    render(<RequestRow request={booking()} isFirst />);

    expect(screen.getByText('Priya N.')).toBeDefined();
    expect(screen.queryByText(/cus-1/)).toBeNull();
  });

  it('falls back to a description rather than a blank when the account has no name', () => {
    render(
      <RequestRow
        request={booking({
          customer: { firstName: '', lastInitial: '', lastName: null, email: null, phone: null },
        })}
        isFirst
      />,
    );

    expect(screen.getByText('A customer')).toBeDefined();
  });

  it('writes the facts line in the frame order', () => {
    render(<RequestRow request={booking()} isFirst />);

    expect(
      screen.getByText('Wedding · Sun Jun 14 · Barr Mansion · 120 guests · Full day coverage'),
    ).toBeDefined();
  });

  it('marks only the topmost row as needing the vendor', () => {
    const { unmount } = render(<RequestRow request={booking()} isFirst />);
    expect(screen.getByText('Needs you')).toBeDefined();
    unmount();

    render(<RequestRow request={booking()} isFirst={false} />);
    expect(screen.getByText('New')).toBeDefined();
    expect(screen.queryByText('Needs you')).toBeNull();
  });

  /*
   * A package request carries a locked price, so it can be accepted outright
   * and there is nothing left to quote. A custom one has no price to accept.
   */
  it('offers Accept on a package request and disables the quote', () => {
    render(<RequestRow request={booking()} isFirst />);

    expect(screen.getByRole('button', { name: 'Accept' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send quote' })).toHaveProperty('disabled', true);
  });

  it('offers only the quote on a custom request', () => {
    render(<RequestRow request={booking({ package: null, finalPriceCents: null })} isFirst />);

    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send quote' })).toHaveProperty('disabled', false);
    expect(screen.getByText('quote needed')).toBeDefined();
  });

  /* Accepting must not require opening the request — that is the row's point. */
  it('accepts from the row and refreshes rather than navigating', async () => {
    requestMock.mockResolvedValue(booking({ status: 'accepted' }));
    render(<RequestRow request={booking()} isFirst />);

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/booking-requests/req-1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('opens the quote field inline and sends the price in cents', async () => {
    requestMock.mockResolvedValue(booking({ status: 'quoted' }));
    render(<RequestRow request={booking({ package: null, finalPriceCents: null })} isFirst />);

    await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await userEvent.type(screen.getByLabelText('Your price'), '3840');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/booking-requests/req-1/quote',
      expect.objectContaining({ body: { quotedPriceCents: 384_000 } }),
    );
  });

  it('refuses a quote under the minimum booking amount', async () => {
    render(<RequestRow request={booking({ package: null, finalPriceCents: null })} isFirst />);

    await userEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await userEvent.type(screen.getByLabelText('Your price'), '10');

    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true);
    expect(screen.getByText('The minimum booking is $25.')).toBeDefined();
  });

  /*
   * A date booked out from under the request is about *this* row, so the
   * message belongs on it — a toast would float away from what it describes.
   */
  it('shows a failed action inline on the row, not as a toast', async () => {
    const { ApiClientError } = await import('@/lib/api-client');
    requestMock.mockRejectedValue(
      new ApiClientError(409, 'CONFLICT', 'That date was booked while this request was open'),
    );
    render(<RequestRow request={booking()} isFirst />);

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('That date was booked while this request was open');
  });

  /*
   * Decline is irreversible — the lifecycle refuses `declined -> accepted` and
   * the customer is notified — so it is the one action on the row that asks
   * first. The 409 guard is correct and stays; the missing step was the ask.
   */
  describe('declining', () => {
    it('does not fire the decline until the confirmation is accepted', async () => {
      render(<RequestRow request={booking()} isFirst />);

      await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

      expect(requestMock).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Decline it' }));

      expect(requestMock).toHaveBeenCalledWith(
        '/booking-requests/req-1/decline',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('names the customer and the date, and says the decline is final', async () => {
      render(<RequestRow request={booking()} isFirst />);

      await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

      expect(screen.getByRole('dialog').textContent).toContain('Decline Priya N.’s request?');
      expect(screen.getByRole('dialog').textContent).toContain('Sun Jun 14');
      expect(screen.getByRole('dialog').textContent).toContain('This cannot be undone');
    });

    it('sends nothing when the vendor backs out of the confirmation', async () => {
      render(<RequestRow request={booking()} isFirst />);

      await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
      await userEvent.click(screen.getByRole('button', { name: 'Keep it open' }));

      expect(requestMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
