import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestModeStrip } from './test-mode-strip';

const COPY = "Test mode: no real money moves. Use Stripe's test card 4242 4242 4242 4242.";

describe('TestModeStrip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('renders the exact copy on a pk_test_ key', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_abc');
    render(<TestModeStrip />);

    expect(screen.getByTestId('test-mode-strip').textContent).toBe(COPY);
  });

  it('renders nothing on a pk_live_ key', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_abc');
    const { container } = render(<TestModeStrip />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no key is set', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '');
    const { container } = render(<TestModeStrip />);

    expect(container.innerHTML).toBe('');
  });

  it('reads the key, not DEPLOY_ENV: shown for a test key in production, absent for a live key', () => {
    vi.stubEnv('DEPLOY_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_abc');
    const test = render(<TestModeStrip />);
    expect(test.container.textContent).toBe(COPY);
    test.unmount();

    vi.stubEnv('DEPLOY_ENV', 'local');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_live_abc');
    const live = render(<TestModeStrip />);
    expect(live.container.innerHTML).toBe('');
  });
});
