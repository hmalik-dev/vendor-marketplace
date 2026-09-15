import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { viewerOn } from '@/testing/viewer-clock';
import type { WireBooking } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const refresh = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { CompleteBooking } = await import('./complete-booking');

/** The day after the fixture's event, so `Mark complete` is offered. */
const TODAY = '2027-02-14';

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

describe('CompleteBooking', () => {
  /*
   * VEN-414. The card used to wait on `router.refresh()` to learn the booking
   * was complete, and on `/vendor/bookings` that refresh was observed to be
   * aborted in the browser (`net::ERR_ABORTED`) with the API's 200 already in:
   * the vendor was left looking at `Mark complete` over a completed booking
   * until they reloaded. The API answers with the booking as it now stands, so
   * that answer is what the card draws.
   */
  it('reads Complete from the API’s answer even when the refresh never lands', async () => {
    requestMock.mockResolvedValue({ ...paid(), status: 'completed', completedAt: new Date() });

    render(<CompleteBooking booking={paid()} serverToday={viewerOn(TODAY)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark complete' }));

    expect(await screen.findByText('Complete')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark complete' })).toBeNull();
    expect(requestMock).toHaveBeenCalledWith(
      '/vendor/bookings/bkg-1/complete',
      expect.objectContaining({ method: 'PUT' }),
    );
    // The rest of the page still re-reads: the heading's count and the notifications.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the control and says so when the API refuses', async () => {
    requestMock.mockRejectedValue(new Error('offline'));

    render(<CompleteBooking booking={paid()} serverToday={viewerOn(TODAY)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark complete' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeDefined();
    expect(screen.queryByText('Complete')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});
