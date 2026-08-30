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
  getVendorCities: async () => [],
}));

vi.mock('@/components/search/header-query', () => ({
  HeaderQuery: () => (pathname === '/search' ? <div data-testid="header-query" /> : null),
}));

/*
 * The bell owns its own fetching and its own stream; the header's job is only
 * to place it, so it is stubbed to whether it rendered.
 */
vi.mock('@/components/messaging/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

/*
 * The role decides whether the header carries the vendor chip. It comes from
 * the local account record rather than Clerk, so it is mocked separately from
 * the signed-in/signed-out state above — the two can disagree, and the chip
 * must follow the record.
 */
let currentRole: 'customer' | 'vendor' | 'admin' | null = null;

vi.mock('@/lib/current-user', () => ({
  readRoleForChrome: async () => currentRole,
}));

const { SiteHeader } = await import('./site-header');

describe('SiteHeader', () => {
  beforeEach(() => {
    authState = 'signed-out';
    pathname = '/';
    currentRole = null;
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
   * One sign-up control, not two: `/sign-up`'s role cards are already the fork,
   * and a second header button would duplicate that decision where a visitor
   * has the least context to make it. The vendor door lives in the nav.
   * See design/design-plan/21-sign-up.md.
   */
  it('carries exactly one sign-up control', async () => {
    render(await SiteHeader());

    expect(screen.queryByRole('link', { name: 'List your services' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Join as a vendor' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /sign up/i })).toHaveLength(1);
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

  it('offers messages, the dashboard and the user button when signed in', async () => {
    authState = 'signed-in';

    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'Messages' })).toHaveProperty(
      'href',
      'http://localhost:3000/messages',
    );
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
    expect(screen.getByRole('button', { name: 'Open user button' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();
  });

  /*
   * Frames `08`, `09`, `10` and `11` all draw a `Vendor` chip beside the
   * wordmark — it is shared chrome, not one screen's decoration, so it is
   * asserted on the header rather than on any single vendor surface.
   */
  it('carries the vendor chip when the account is a vendor', async () => {
    authState = 'signed-in';
    currentRole = 'vendor';

    render(await SiteHeader());

    expect(screen.getByText('Vendor')).toBeDefined();
  });

  it('withholds the vendor chip from a customer', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());

    expect(screen.queryByText('Vendor')).toBeNull();
  });

  it('withholds the vendor chip from a signed-out visitor', async () => {
    render(await SiteHeader());

    expect(screen.queryByText('Vendor')).toBeNull();
  });

  /*
   * The header must not be able to cost the page. It sits in the root layout,
   * where a throw escapes every `error.tsx` and takes the whole document to
   * the global error screen — so the chip's read degrades to null rather than
   * propagating. That degrade lives in `readRoleForChrome` and is tested in
   * `current-user.test.ts`; here it is enough that a null role still renders.
   */
  it('renders without a chip when the role is unreadable', async () => {
    authState = 'signed-in';
    currentRole = null;

    render(await SiteHeader());

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
    expect(screen.queryByText('Vendor')).toBeNull();
  });
});
