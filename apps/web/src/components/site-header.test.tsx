import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
  UserButton: () => <button type="button">Open user button</button>,
}));

const { SiteHeader } = await import('./site-header');

describe('SiteHeader', () => {
  beforeEach(() => {
    authState = 'signed-out';
  });

  afterEach(() => {
    cleanup();
  });

  it('links the wordmark to the home page', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'VenMatch' })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
  });

  it('labels the primary navigation landmark', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
  });

  it('sends signed-out visitors to the full sign-in and sign-up pages', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-in',
    );
    // Sign-up must be a page, not a modal: it collects the role first.
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up',
    );
    expect(screen.queryByRole('button', { name: 'Open user button' })).toBeNull();
  });

  it('offers the dashboard and user button when signed in', () => {
    authState = 'signed-in';

    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
    expect(screen.getByRole('button', { name: 'Open user button' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Get started' })).toBeNull();
  });
});
