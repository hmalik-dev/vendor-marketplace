import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPayoutsForm } from './connect-payouts-form';

const request = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

/**
 * The one control that takes a vendor to Stripe. What matters is that it names
 * what it is about to do, that it cannot be pressed twice into two hosted
 * sessions, and that a failure says what happened in the product's own words —
 * the API's own sentence is never shown (`40-states.md`).
 */
describe('ConnectPayoutsForm', () => {
  const assign = vi.fn();

  beforeEach(() => {
    request.mockReset();
    assign.mockReset();
    // jsdom refuses a real navigation, so the one side effect is stubbed.
    Object.defineProperty(window, 'location', { configurable: true, value: { assign } });
  });

  afterEach(() => {
    cleanup();
  });

  it('names the first-time action', () => {
    render(<ConnectPayoutsForm isResuming={false} />);

    expect(screen.getByRole('button').textContent).toBe('Set up payouts');
  });

  it('names the resumed action for a vendor who already started', () => {
    render(<ConnectPayoutsForm isResuming />);

    expect(screen.getByRole('button').textContent).toBe('Continue setup');
  });

  it('sends the vendor to the URL the API minted', async () => {
    request.mockResolvedValue({ url: 'https://connect.stripe.com/setup/e/acct_1/abc' });
    render(<ConnectPayoutsForm isResuming={false} />);

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/acct_1/abc');
    });
    expect(request).toHaveBeenCalledWith(
      '/vendor/stripe/connect',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('stays busy through the redirect rather than inviting a second press', async () => {
    // Never resolves: the page is on its way out, so the control must not reset
    // and offer a second hosted session against the same account.
    request.mockReturnValue(new Promise(() => {}));
    render(<ConnectPayoutsForm isResuming={false} />);

    await userEvent.click(screen.getByRole('button'));

    const button = screen.getByRole('button') as HTMLButtonElement;
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Opening Stripe…');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports a failure in the product’s words, never the API’s', async () => {
    request.mockRejectedValue(new Error('Invalid API Key provided: sk_test_***abcd'));
    render(<ConnectPayoutsForm isResuming={false} />);

    await userEvent.click(screen.getByRole('button'));

    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('We could not reach Stripe just then.');
    expect(banner.textContent).not.toContain('sk_test');
    expect(banner.textContent).not.toContain('API Key');
    // Red, because this one did fail — `40-states.md`.
    expect(banner.className).toContain('error');
    expect(assign).not.toHaveBeenCalled();
  });

  it('offers the action again after a failure', async () => {
    request.mockRejectedValue(new Error('nope'));
    render(<ConnectPayoutsForm isResuming={false} />);

    await userEvent.click(screen.getByRole('button'));
    await screen.findByRole('status');

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Set up payouts');
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
