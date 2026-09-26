import { BOOKING_REPORT_CATEGORY_LABELS } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

const { BookingReportDialog } = await import('./booking-report-dialog');

const BOOKING_ID = '3b2f8c1e-8d55-4d3f-8f0d-3c9a5f21bb01';
const RECEIPT = { reference: 'ORL-4K7Q-P2', replyTo: 'priya@example.com' };

function renderDialog(side: 'customer' | 'vendor'): void {
  render(
    <BookingReportDialog
      bookingId={BOOKING_ID}
      side={side}
      counterpartName={side === 'customer' ? 'Kessler & Co.' : 'Priya Nandakumar'}
      eventDate="2026-06-14"
    />,
  );
}

async function openDialog(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Report a problem' }));
  await screen.findByRole('dialog');
  return user;
}

function categories(): string[] {
  return screen.getAllByRole('radio').map((radio) => radio.parentElement!.textContent!);
}

describe('BookingReportDialog (VEN-770)', () => {
  beforeEach(() => {
    request.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("draws the customer's categories and names the vendor and the date", async () => {
    renderDialog('customer');
    await openDialog();

    expect(categories()).toEqual([
      'The vendor didn’t show up',
      'The service wasn’t what was agreed',
      'Something about payment',
      'Something else',
    ]);
    expect(
      screen.getByText(
        'About your booking with Kessler & Co. on Jun 14, 2026. An admin reads every report.',
      ),
    ).toBeDefined();
  });

  it("draws the vendor's categories and names the customer", async () => {
    renderDialog('vendor');
    await openDialog();

    expect(categories()).toEqual([
      'The customer canceled outside the app',
      'Venue access or safety',
      'Something else',
    ]);
    expect(
      screen.getByText('About your booking with Priya Nandakumar on Jun 14, 2026.'),
    ).toBeDefined();
  });

  it('sends the booking, the category and the detail to the support intake', async () => {
    request.mockResolvedValue(RECEIPT);
    renderDialog('customer');
    const user = await openDialog();

    await user.click(screen.getByLabelText(BOOKING_REPORT_CATEGORY_LABELS['vendor-no-show']));
    await user.type(screen.getByLabelText('What happened'), 'Nobody came.');
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]![0]).toBe('/support/messages');
    expect(request.mock.calls[0]![1].body).toEqual({
      topic: 'booking-or-payment',
      bookingId: BOOKING_ID,
      bookingCategory: 'vendor-no-show',
      message: 'Nobody came.',
    });
  });

  it('sends the category label as the message when no detail is typed', async () => {
    request.mockResolvedValue(RECEIPT);
    renderDialog('vendor');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Venue access or safety'));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]![1].body.message).toBe('Venue access or safety');
  });

  it('refuses "Something else" with no detail inline, sending nothing', async () => {
    renderDialog('customer');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Something else'));
    await user.type(screen.getByLabelText('What happened'), '   ');
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect(screen.getByText('Tell us what happened.')).toBeDefined();
    expect(screen.getByLabelText('What happened').getAttribute('aria-invalid')).toBe('true');
    expect(request).not.toHaveBeenCalled();
  });

  it('cannot be sent twice while the first send is in flight', async () => {
    let resolve: (value: typeof RECEIPT) => void = () => undefined;
    request.mockReturnValue(new Promise((settle) => (resolve = settle)));
    renderDialog('customer');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Something about payment'));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    const sending = screen.getByRole('button', { name: 'Sending' });
    expect(sending.hasAttribute('disabled')).toBe(true);
    await user.click(sending);
    expect(request).toHaveBeenCalledTimes(1);

    resolve(RECEIPT);
    await screen.findByText('Report sent');
  });

  it('shows frame 51b Report sent and moves focus to it', async () => {
    request.mockResolvedValue(RECEIPT);
    renderDialog('customer');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Something about payment'));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    const title = await screen.findByText('Report sent');
    expect(
      screen.getByText(
        'An admin will look at it and reply by email. Your payment stays held while the case is open.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report a problem' })).toBeNull();
    await waitFor(() => expect(title.closest('[tabindex="-1"]')).toBe(document.activeElement));
  });

  it('says nothing about a held payment to the vendor', async () => {
    request.mockResolvedValue(RECEIPT);
    renderDialog('vendor');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Venue access or safety'));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    await screen.findByText('Report sent');
    expect(screen.getByText('An admin will look at it and reply by email.')).toBeDefined();
  });

  it('keeps the dialog open and says why when the send is refused', async () => {
    request.mockRejectedValue(new Error('offline'));
    renderDialog('customer');
    const user = await openDialog();

    await user.click(screen.getByLabelText('Something about payment'));
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That report did not reach us. Check your connection and try again.',
    );
    expect(screen.getByRole('button', { name: 'Send report' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'Cancel',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Cancel' })),
    ],
  ])('returns focus to the trigger on %s', async (_how, close) => {
    renderDialog('customer');
    const user = await openDialog();

    await close(user);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Report a problem' })),
    );
  });
});
