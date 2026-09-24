import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StripeDashboardLink } from './stripe-dashboard-link';

const request = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

/** VEN-725: the vendor's way into the Stripe Express dashboard, where the tax forms are. */
describe('StripeDashboardLink', () => {
  const assign = vi.fn();

  beforeEach(() => {
    request.mockReset();
    assign.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } });
  });

  afterEach(() => {
    cleanup();
  });

  it('is labelled with the words the ticket fixes', () => {
    render(<StripeDashboardLink />);

    expect(screen.getByRole('button').textContent).toBe('Open your Stripe dashboard');
  });

  it('mints a link on the press and sends the vendor to it', async () => {
    request.mockResolvedValue({ url: 'https://connect.stripe.com/express/acct_1/abc' });
    render(<StripeDashboardLink />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/express/acct_1/abc');
    });
    expect(request).toHaveBeenCalledWith(
      '/vendor/stripe/dashboard-link',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('says so, in the product words, when Stripe cannot be reached', async () => {
    request.mockRejectedValue(new Error('upstream: rk_live_secret detail'));
    render(<StripeDashboardLink />);

    await userEvent.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('We could not reach Stripe just then. Try again.');
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button').textContent).toBe('Open your Stripe dashboard');
  });
});
