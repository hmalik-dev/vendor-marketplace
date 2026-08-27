import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_NAME } from '@vendor-marketplace/shared';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
  UserButton: () => <button type="button">Open user button</button>,
}));

/*
 * The header fetches the taxonomy because frame `02` puts the query bar in it.
 * The bar itself is `HeaderQuery`'s to test — it owns the `nuqs` state — so
 * here it is stubbed down to whether it rendered at all.
 */
const getCategories = vi.fn(async () => []);

vi.mock('@/lib/vendor-data', () => ({
  getCategories: () => getCategories(),
}));

vi.mock('@/components/search/header-query', () => ({
  HeaderQuery: () => (pathname === '/search' ? <div data-testid="header-query" /> : null),
}));

const { SiteHeader } = await import('./site-header');

describe('SiteHeader', () => {
  beforeEach(() => {
    authState = 'signed-out';
    pathname = '/';
  });

  afterEach(() => {
    cleanup();
  });

  it('links the wordmark to the home page', async () => {
    render(await SiteHeader());

    expect(screen.getByRole('link', { name: BRAND_NAME })).toHaveProperty(
      'href',
      'http://localhost:3000/',
    );
  });

  it('labels the primary navigation landmark', async () => {
    render(await SiteHeader());

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
  });

  it('sends signed-out visitors to the full sign-in and sign-up pages', async () => {
    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-in',
    );
    // Sign-up must be a page, not a modal: it collects the role first.
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up',
    );
    expect(screen.queryByRole('button', { name: 'Open user button' })).toBeNull();
  });

  /*
   * Both account types are reachable from the first screen. The pill is the
   * customer path because that is the volume; the vendor path is *named* and
   * arrives with the role pre-selected, so `/sign-up`'s cards stay the real
   * fork. See design/design-plan/21-sign-up.md.
   */
  it('offers the vendor door as a named link carrying the role', async () => {
    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'List your services' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up?role=vendor',
    );
    // The old single "Join as a vendor" pill is gone — it offered the
    // low-volume path as the page's only account action.
    expect(screen.queryByRole('link', { name: 'Join as a vendor' })).toBeNull();
  });

  it('carries the marketing nav on the landing page', async () => {
    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveProperty(
      'href',
      'http://localhost:3000/search',
    );
    expect(screen.getByRole('link', { name: 'How it works' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'For vendors' })).toBeDefined();
  });

  it('drops the marketing nav elsewhere, where the frames fill that space differently', async () => {
    pathname = '/search';

    render(await SiteHeader());

    expect(screen.queryByRole('link', { name: 'Browse' })).toBeNull();
    // The wordmark and the account actions survive — only the nav is scoped.
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();
  });

  /*
   * Frame `02` puts the query bar inside this 64px bar; frame `01` puts the
   * marketing nav there instead. The two are mutually exclusive by route.
   */
  it('carries the query bar on the search screen and the nav on the landing page', async () => {
    pathname = '/search';
    const search = render(await SiteHeader());
    expect(search.getByTestId('header-query')).toBeDefined();
    expect(search.queryByRole('link', { name: 'Browse' })).toBeNull();

    cleanup();

    pathname = '/';
    const landing = render(await SiteHeader());
    expect(landing.queryByTestId('header-query')).toBeNull();
    expect(landing.getByRole('link', { name: 'Browse' })).toBeDefined();
  });

  it('hides the marketing nav from a signed-in visitor', async () => {
    authState = 'signed-in';

    render(await SiteHeader());

    expect(screen.queryByRole('link', { name: 'Browse' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'For vendors' })).toBeNull();
  });

  it('offers the dashboard and user button when signed in', async () => {
    authState = 'signed-in';

    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
    expect(screen.getByRole('button', { name: 'Open user button' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'List your services' })).toBeNull();
  });
});
