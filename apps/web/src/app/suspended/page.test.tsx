import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/auth-requests', () => ({ signOut: vi.fn() }));

const { default: SuspendedPage } = await import('./page');

afterEach(cleanup);

/* VEN-763, frame 53: the dead end still has two ways out. */
describe('/suspended', () => {
  it('offers Contact support to /support and a Sign out', () => {
    render(<SuspendedPage />);

    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href')).toBe(
      '/support',
    );
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Back to home' })).toBeNull();
  });

  it('claims no refund, since the page cannot tell a vendor from a customer', () => {
    render(<SuspendedPage />);

    expect(screen.queryByText(/refunded/)).toBeNull();
  });
});
