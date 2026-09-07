import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import {
  BRAND_NAME,
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
  /*
   * Clerk's own control, rendered as the button it clones its child into. The
   * session mutation behind it is Clerk's to test; what this file asserts is
   * that the control is offered to the right reader and to nobody else.
   */
  SignOutButton: ({ children }: { children: ReactNode }) => children,
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

  /*
   * `Sign in` · `Sign up`, and **no `Dashboard`** — a visitor has no dashboard,
   * and this column is the one place the footer could have offered them one.
   *
   * `Become a vendor` came off this column with #428: the vendor door is
   * already in Company as `For vendors`, at the same destination, one column to
   * the left. `/sign-up`'s role cards are the fork — 21-sign-up.md.
   */
  it('offers the authentication routes to signed-out visitors', async () => {
    render(await SiteFooter());

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-in',
    );
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up',
    );
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('hides the authentication routes once signed in', async () => {
    authState = 'signed-in';
    currentRole = 'vendor';

    render(await SiteFooter());

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });

  /*
   * Signed in, the Account column is the way back to your own things, and every
   * label is the word the reader already meets on the surface it leads to —
   * `My bookings` and `My profile` are the customer sidebar's own rows,
   * `Dashboard` is the first row of the vendor's rail. A fourth word for a
   * destination that already has one is how a control comes to be called two
   * things (#372).
   */
  it.each([
    [
      'customer' as const,
      [
        ['My bookings', '/bookings'],
        ['Messages', '/messages'],
        ['My profile', '/customer/profile'],
      ],
    ],
    [
      'vendor' as const,
      [
        ['Dashboard', '/dashboard'],
        ['Messages', '/messages'],
        ['Edit profile', '/vendor/profile/edit'],
      ],
    ],
    /* An operator has neither messages nor a profile; a short column beats rows
     * that bounce. */
    ['admin' as const, [['Admin', '/dashboard']]],
  ])('gives a %s account their own surfaces', async (role, expected) => {
    authState = 'signed-in';
    currentRole = role;

    render(await SiteFooter());

    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label as string }), label).toHaveProperty(
        'href',
        `http://localhost:3000${href as string}`,
      );
    }

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  /*
   * A row, never a fifth column — a column would give three links the same
   * visual weight as Browse, which is the whole catalogue.
   *
   * **#427 adds the same row from the legal-pages side.** It is built here, so
   * that ticket must leave it alone rather than build a second one: "exactly
   * once" is what this asserts.
   */
  it('carries the legal row exactly once, in both auth states', async () => {
    for (const state of ['signed-out', 'signed-in'] as const) {
      authState = state;
      currentRole = state === 'signed-in' ? 'customer' : null;
      render(await SiteFooter());

      for (const [label, href] of [
        ['Terms', '/terms'],
        ['Privacy', '/privacy'],
        ['Cookies', '/cookies'],
      ]) {
        expect(screen.getAllByRole('link', { name: label as string }), label).toHaveLength(1);
        expect(screen.getByRole('link', { name: label as string })).toHaveProperty(
          'href',
          `http://localhost:3000${href as string}`,
        );
      }

      cleanup();
    }
  });

  /*
   * The year is resolved, not written out: a literal is wrong from the first of
   * January and nothing fails when it becomes so. The name is read from
   * `BRAND_NAME` for the same reason it is everywhere else.
   */
  it('dates the copyright notice from the clock and names the brand from the constant', async () => {
    render(await SiteFooter());

    expect(screen.getByText(`© ${BRAND_NAME} ${new Date().getFullYear()}`)).toBeDefined();
  });

  /*
   * The footer's own ink, one step below the closing band's. Two masses of the
   * same `stone-900` separated by a hairline read as one 400px dark region, so
   * the value does the separating and the rule comes off with it.
   *
   * A class-level fact: jsdom computes no cascade, and the rendered colour is
   * the parity pass's to confirm in a browser — see
   * `.claude/rules/web-design-parity.md`.
   */
  it('grounds the footer one ink step below the band above it', async () => {
    const { container } = render(await SiteFooter());

    const footer = container.querySelector('[data-slot="site-footer"]');
    const classes = footer?.className.split(/\s+/) ?? [];

    expect(classes).toContain('bg-stone-950');
    expect(classes).not.toContain('bg-stone-900');
    expect(classes).not.toContain('border-t');
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
