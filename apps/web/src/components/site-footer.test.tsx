import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import {
  CATEGORY_SEEDS,
  LANDING_JUMP_CATEGORY_SLUGS,
  SUPPORT_PATH,
} from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

/*
 * The footer's account link is labelled by role, the same table the header and
 * its drawer read — so the role is mocked separately from the signed-in state
 * above, exactly as `site-header.test.tsx` does. The two can disagree, and the
 * label must follow the record.
 */
let currentRole: 'customer' | 'vendor' | 'admin' | null = null;

vi.mock('@/lib/current-user', () => ({
  readRoleForChrome: async () => currentRole,
}));

const { SiteFooter } = await import('./site-footer');

describe('SiteFooter', () => {
  beforeEach(() => {
    authState = 'signed-out';
    currentRole = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('labels the footer navigation landmark', async () => {
    render(await SiteFooter());

    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeDefined();
  });

  it('carries the four columns the design calls for', async () => {
    render(await SiteFooter());

    for (const heading of ['Browse', 'Company', 'Account']) {
      expect(screen.getByText(heading), heading).toBeDefined();
    }
    expect(screen.getByText('Made for the people who make the day.')).toBeDefined();
  });

  it('sends the browse column into search with a category already chosen', async () => {
    render(await SiteFooter());

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
  it('browses the four categories the hero jumps to, in their order', async () => {
    render(await SiteFooter());

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

  it('offers the authentication routes to signed-out visitors', async () => {
    render(await SiteFooter());

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

  it('hides the authentication routes once signed in', async () => {
    authState = 'signed-in';
    currentRole = 'vendor';

    render(await SiteFooter());

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Become a vendor' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });

  /*
   * The account link is one control with three destinations, and the footer is
   * its third rendering — after the header's bar and the drawer the bar hides it
   * into. It read `Dashboard` for everyone, so a signed-in customer met both
   * words on the same page: `Bookings` in the bar, `Dashboard` here, for one
   * link. #372.
   */
  it.each([
    ['customer' as const, 'Bookings'],
    ['vendor' as const, 'Dashboard'],
    ['admin' as const, 'Admin'],
  ])('labels the account link for a %s account', async (role, label) => {
    authState = 'signed-in';
    currentRole = role;

    render(await SiteFooter());

    expect(screen.getByRole('link', { name: label })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });

  /*
   * `20-customer-bookings-hub.md`'s acceptance is "the word 'dashboard' appears
   * nowhere in the UI", and the footer renders on every public route — so this
   * is the surface where a customer was most likely to read it.
   */
  it('never shows a customer the word "Dashboard"', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteFooter());

    expect(document.body.textContent).not.toContain('Dashboard');
  });

  /*
   * #421, absorbing #420. `Contact support` is in Company rather than Account
   * because it is the one row of this footer that is true for everyone: the
   * visitor most likely to need it is the one who cannot sign in, and Account
   * is the column that changes under them.
   */
  it('offers Contact support to signed-out and signed-in visitors alike', async () => {
    for (const state of ['signed-out', 'signed-in'] as const) {
      authState = state;
      render(await SiteFooter());

      expect(screen.getByRole('link', { name: 'Contact support' }), state).toHaveProperty(
        'href',
        `http://localhost:3000${SUPPORT_PATH}`,
      );

      cleanup();
    }
  });
});

/*
 * #420's regression guard, moved here whole when #421 absorbed that ticket.
 *
 * Measured 2026-09-06: the footer's Browse column and the landing hero's jump
 * chips **already agree**, because both derive from
 * `LANDING_JUMP_CATEGORY_SLUGS`. There is no drift to fix — what was missing is
 * anything holding them together, so an edit to either could silently diverge
 * them and nothing would say so. Both halves are asserted, because either one
 * alone passes on the broken version: rendering the footer against the constant
 * says nothing about what the hero reads, and reading the hero's source says
 * nothing about what the footer renders.
 */
describe('the footer Browse column and the landing hero name the same categories', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the constant, in its order, followed by the catch-all', async () => {
    authState = 'signed-out';
    render(await SiteFooter());

    const expected = [
      ...LANDING_JUMP_CATEGORY_SLUGS.map(
        (slug) => CATEGORY_SEEDS.find((seed) => seed.slug === slug)?.name ?? slug,
      ),
      'All vendors',
    ];

    for (const [index, slug] of LANDING_JUMP_CATEGORY_SLUGS.entries()) {
      expect(screen.getByRole('link', { name: expected[index] as string })).toHaveProperty(
        'href',
        `http://localhost:3000/search?category=${slug}`,
      );
    }

    expect(screen.getByRole('link', { name: 'All vendors' })).toHaveProperty(
      'href',
      'http://localhost:3000/search',
    );
  });

  it('reads the landing hero off the same constant, not a second list', () => {
    /*
     * The hero's own source, at test time. A shadow copy of the four names
     * here would pass the exact silent-divergence case this exists to catch —
     * the same reasoning `route-parity-ledger.test.ts` gives for reading its
     * two documents by hand.
     */
    const hero = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');

    expect(hero).toContain('LANDING_JUMP_CATEGORY_SLUGS');
    // Its chips are mapped from the constant rather than from a literal array.
    expect(hero).toMatch(/LANDING_JUMP_CATEGORY_SLUGS\.map\(/);
  });
});
