import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/checkout/checkout-screen', () => ({ SAGE_DOT: 'sage-dot' }));
// The screen fetches categories through the auth client; the boundary file is what is under test.
vi.mock('@/components/errors/not-found-screen', () => ({
  NotFoundScreen: () => <h1>Not found</h1>,
}));

const { default: CheckoutLayout } = await import('./layout');
const { default: CheckoutNotFound } = await import('./not-found');

const COPY = "Test mode: no real money moves. Use Stripe's test card 4242 4242 4242 4242.";

describe('CheckoutLayout test-mode strip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('mounts the strip once above the header, around whatever state the route renders', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_abc');
    const { container } = render(
      <CheckoutLayout>
        <CheckoutNotFound />
      </CheckoutLayout>,
    );

    const strips = screen.getAllByTestId('test-mode-strip');
    expect(strips).toHaveLength(1);
    expect(strips[0]?.textContent).toBe(COPY);
    const header = container.querySelector('header');
    expect(
      strips[0]?.compareDocumentPosition(header as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('draws no strip under a live key', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_abc');
    render(
      <CheckoutLayout>
        <CheckoutNotFound />
      </CheckoutLayout>,
    );

    expect(screen.queryByTestId('test-mode-strip')).toBeNull();
  });
});
