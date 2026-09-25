import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { viewerOn } from '@/testing/viewer-clock';
import type { WireBooking } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { CancelBooking } = await import('./cancel-booking');

/** Two days before the fixture's event: the earliest it is ahead in every time zone. */
const TODAY = '2027-02-11';

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  refresh.mockReset();
});

function paid(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'bkg-1',
    requestId: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2027-02-13',
    eventLocation: 'Zilker Park Clubhouse',
    totalAmountCents: 120_000,
    status: 'confirmed',
    paidAt: new Date(),
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    payoutReleasedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventType: 'wedding',
    venue: 'Zilker Park Clubhouse',
    ...overrides,
  } as WireBooking;
}

describe('CancelBooking', () => {
  it('asks for a reason and names the full refund before anything is sent', async () => {
    viewerOn(TODAY);
    render(<CancelBooking booking={paid()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    expect(requestMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Reason for the customer'));
    expect(
      screen.getByText(
        'The customer is refunded $1,200 in full and you are not paid for this booking. This cannot be undone.',
      ),
    ).toBeDefined();
    const confirm = screen.getByRole('button', { name: 'Yes, cancel and refund $1,200' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText('Reason for the customer'), '  Family emergency ');
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends the trimmed reason, refreshes the page and draws nothing once cancelled', async () => {
    requestMock.mockResolvedValue({
      booking: { ...paid(), status: 'cancelled' },
      refundCents: 120_000,
      isFullRefund: true,
    });

    viewerOn(TODAY);
    const { container } = render(<CancelBooking booking={paid()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.type(screen.getByLabelText('Reason for the customer'), '  Family emergency ');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel and refund $1,200' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/vendor/bookings/bkg-1/cancel',
      expect.objectContaining({ method: 'PUT', body: { reason: 'Family emergency' } }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('');
  });

  it('keeps the confirm step and shows the refusal when the API says no', async () => {
    requestMock.mockRejectedValue(new Error('offline'));

    viewerOn(TODAY);
    render(<CancelBooking booking={paid()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.type(screen.getByLabelText('Reason for the customer'), 'Family emergency');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel and refund $1,200' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep the booking' })).toBeDefined();
  });

  it('goes back to the booking without sending anything', async () => {
    viewerOn(TODAY);
    render(<CancelBooking booking={paid()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep the booking' }));

    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeDefined();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a cancelled booking', paid({ status: 'cancelled' }), TODAY],
    ['a disputed booking', paid({ status: 'disputed' }), TODAY],
    ['a paid-out booking', paid({ payoutReleasedAt: new Date() }), TODAY],
    ['an event that is today', paid(), '2027-02-13'],
    ['an event that is tomorrow somewhere on Earth', paid(), '2027-02-12'],
    ['an event that has passed', paid(), '2027-02-14'],
  ])('offers nothing for %s', (_name, booking, today) => {
    viewerOn(today);
    const { container } = render(<CancelBooking booking={booking} />);

    expect(container.textContent).toBe('');
  });
});
