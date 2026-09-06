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

  /*
   * #421, absorbing #420. `Contact support` is in Company rather than Account
   * because it is the one row of this footer that is true for everyone: the
   * visitor most likely to need it is the one who cannot sign in, and Account
   * is the column that changes under them.
   */
  it('offers Contact support to signed-out and signed-in visitors alike', () => {
    for (const state of ['signed-out', 'signed-in'] as const) {
      authState = state;
      render(<SiteFooter />);

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

  it('renders the constant, in its order, followed by the catch-all', () => {
    authState = 'signed-out';
    render(<SiteFooter />);

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
