import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STRIPE_DASHBOARD_COPY,
  StripeDashboardCard,
  stripeDashboardPaymentUrl,
} from './stripe-dashboard-card';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

/** VEN-601: the booking and case details link the payment out to Stripe. */
describe('stripeDashboardPaymentUrl', () => {
  it('opens the test-mode Dashboard for a test key', () => {
    expect(stripeDashboardPaymentUrl('pi_3PqR', 'pk_test_abc')).toBe(
      'https://dashboard.stripe.com/test/payments/pi_3PqR',
    );
  });

  it('opens the live Dashboard only for a live key', () => {
    expect(stripeDashboardPaymentUrl('pi_3PqR', 'pk_live_abc')).toBe(
      'https://dashboard.stripe.com/payments/pi_3PqR',
    );
  });

  it('falls back to test mode when there is no key', () => {
    expect(stripeDashboardPaymentUrl('pi_3PqR', undefined)).toBe(
      'https://dashboard.stripe.com/test/payments/pi_3PqR',
    );
  });

  it('keeps a stored id inside its path segment', () => {
    expect(stripeDashboardPaymentUrl('pi_1/../x?y', 'pk_test_abc')).toBe(
      'https://dashboard.stripe.com/test/payments/pi_1%2F..%2Fx%3Fy',
    );
  });
});

describe('StripeDashboardCard', () => {
  it('links the payment intent out in a new tab, with the copy beside it', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_abc');
    const { container } = render(<StripeDashboardCard paymentIntentId="pi_3PqR" />);

    const link = screen.getByRole('link', { name: 'Open the payment in the Stripe Dashboard' });
    expect(link.getAttribute('href')).toBe('https://dashboard.stripe.com/test/payments/pi_3PqR');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.textContent).toContain(STRIPE_DASHBOARD_COPY);
    // A card holding a link is never declared read-only.
    expect(container.querySelector('[data-admin-card]')?.hasAttribute('data-read-only')).toBe(
      false,
    );
  });

  it('opens the live Dashboard when the web runs on a live key', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_abc');
    render(<StripeDashboardCard paymentIntentId="pi_3PqR" />);

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'https://dashboard.stripe.com/payments/pi_3PqR',
    );
  });
});
