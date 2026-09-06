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

  it('carries the four columns the design calls for', () => {
    render(<SiteFooter />);

    for (const heading of ['Browse', 'Company', 'Account']) {
      expect(screen.getByText(heading), heading).toBeDefined();
    }
    expect(screen.getByText('Made for the people who make the day.')).toBeDefined();
  });

  it('sends the browse column into search with a category already chosen', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Photography' })).toHaveProperty(
      'href',
      'http://localhost:3000/search?category=photography',
    );
    expect(screen.getByRole('link', { name: 'All vendors' })).toHaveProperty(
      'href',
      'http://localhost:3000/search',
    );
  });

  /*
   * The column derives from `LANDING_JUMP_CATEGORY_SLUGS` precisely so it can
   * never disagree with the landing hero — which is only worth anything if
   * something checks that both really render the ruled four (#419). Asserted
   * against the literal list rather than the constant, so a wrong edit to the
   * constant fails here instead of being mirrored into the expectation.
   */
  it('browses the four categories the hero jumps to, in their order', () => {
    render(<SiteFooter />);

    const browse = screen.getByText('Browse').parentElement;
    expect(browse).not.toBeNull();

    expect([...browse!.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Photography',
      'Catering',
      'Entertainment',
      'Beauty',
      'All vendors',
    ]);
    expect(screen.queryByRole('link', { name: 'Florals' })).toBeNull();
  });

  it('offers the authentication routes to signed-out visitors', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-in',
    );
    // The vendor door pre-selects the role — design/design-plan/21-sign-up.md.
    expect(screen.getByRole('link', { name: 'Become a vendor' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up?role=vendor',
    );
  });

  it('hides the authentication routes once signed in', () => {
    authState = 'signed-in';

    render(<SiteFooter />);

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Become a vendor' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });
});
