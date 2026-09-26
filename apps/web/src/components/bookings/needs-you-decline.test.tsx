import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeedsYouDecline } from './needs-you-decline';
import { REQUEST_DID_NOT_ARRIVE } from '@/lib/user-facing-error';

const requestMock = vi.fn();
const rereadMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('@/lib/use-reread-route', () => ({ useRereadRoute: () => rereadMock }));

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
  rereadMock.mockReset();
});

afterEach(cleanup);

/*
 * VEN-746. A decline cannot be undone by the customer and sits beside `Review
 * quote` in the rail, so the first press only asks.
 */
describe('NeedsYouDecline', () => {
  it('asks before sending anything', async () => {
    render(<NeedsYouDecline requestId="req-1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(screen.getByRole('button', { name: 'Confirm decline' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('puts Decline back on Keep, still without sending', async () => {
    render(<NeedsYouDecline requestId="req-1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(screen.getByRole('button', { name: 'Decline' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Confirm decline' })).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('declines through the API once on Confirm decline, then refreshes', async () => {
    render(<NeedsYouDecline requestId="req-1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      '/booking-requests/req-1/decline',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(rereadMock).toHaveBeenCalledTimes(1);
    // The panel leaves on the refresh; until then a second press cannot post again.
    expect(
      (screen.getByRole('button', { name: 'Confirm decline' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows the approved failure copy and does not refresh when the call fails', async () => {
    requestMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<NeedsYouDecline requestId="req-1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));

    expect(screen.getByRole('alert').textContent).toBe(REQUEST_DID_NOT_ARRIVE);
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDefined();
    expect(rereadMock).not.toHaveBeenCalled();
  });
});
