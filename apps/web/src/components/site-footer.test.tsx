import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

const { SiteFooter } = await import('./site-footer');

describe('SiteFooter', () => {
  beforeEach(() => {
    authState = 'signed-out';
  });

  afterEach(() => {
    cleanup();
  });

  it('labels the footer navigation landmark', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeDefined();
  });

  it('offers the authentication routes to signed-out visitors', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-in',
    );
    expect(screen.getByRole('link', { name: 'Become a vendor' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up',
    );
  });

  it('hides the authentication routes once signed in', () => {
    authState = 'signed-in';

    render(<SiteFooter />);

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Become a vendor' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
  });
});
