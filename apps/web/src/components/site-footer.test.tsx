import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CATEGORY_SEEDS,
  LANDING_JUMP_CATEGORY_SLUGS,
  SUPPORT_PATH,
} from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deltaFrame } from '@/testing/design-frames';

/**
 * The type scale, so a size drawn in a frame can be checked against the step
 * this footer actually asks for.
 *
 * A frame states pixels and the markup states a token, and nothing otherwise
 * connects the two: `text-base` and `text-action` are half a pixel apart, and
 * an assertion naming either one on its own passes whatever the frame draws.
 * Reading the scale is what makes "the frame draws 13px" and "the footer uses
 * `text-action`" the same claim. Each step is a distinct value, so the lookup
 * is unambiguous.
 */
const THEME = readFileSync(
  join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
  'utf8',
);

function typeStepFor(px: number): string {
  const step = new RegExp(`--text-([a-z]+): ${px}px;`).exec(THEME);

  if (step === null) {
    throw new Error(`the type scale has no ${px}px step, which is what the frame draws`);
  }

  return `text-${step[1] as string}`;
}

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
   * `How it works` is an anchor, and the footer renders on every route — so it
   * is only a link for a reader whose `/` has the section to land on.
   *
   * A signed-in customer's does not, since #428 took it off their landing, and
   * a vendor never reaches `/` at all. A signed-out visitor and an operator
   * both render it. Both directions are asserted: the presence half alone
   * passes on the broken version.
   */
  it.each([
    [null, true],
    ['admin' as const, true],
    ['customer' as const, false],
    ['vendor' as const, false],
  ])('offers How it works to a %s only when the section exists for them', async (role, offered) => {
    authState = role === null ? 'signed-out' : 'signed-in';
    currentRole = role;

    render(await SiteFooter());

    const link = screen.queryByRole('link', { name: 'How it works' });

    if (offered) {
      expect(link).toHaveProperty('href', 'http://localhost:3000/#how-it-works');
    } else {
      expect(link).toBeNull();
    }

    // The rest of the column is unconditional either way.
    expect(screen.getByRole('link', { name: 'For vendors' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeDefined();
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

    /*
     * #430. The compensating rule is gone from the footer itself, and the
     * legal row's own hairline is a different rule that stays — it separates
     * the legal links from the four-column grid, not the footer from the band.
     */
    const legalRow = container.querySelector('[data-slot="footer-legal"]');
    expect(legalRow?.className.split(/\s+/) ?? []).toContain('border-t');
  });

  /*
   * #441, layout axis. The closing-band delta frame is the only one that draws
   * this footer, and it draws it twice — signed out and signed in — with the
   * same numbers both times, which is the corroboration D30 asks for. Every
   * number below is read back out of the frame rather than restated, so the
   * markup and the frame cannot drift apart in silence.
   *
   * jsdom lays nothing out, so this is the class-level half: the box, the grid
   * template and the gap that together produce 419/280/280/280 at 1440. The
   * rendered ladder is the parity pass's to confirm in a browser.
   */
  it('lays the footer box and its columns on the frame’s ladder', async () => {
    /*
     * Found by the footer's own ground (`stone-950`), not by the values being
     * asserted — the frame holds five grids and three of them belong to the
     * band above. The padding rides along because it is on the same element.
     */
    const drawn = [
      ...deltaFrame('delta-band').matchAll(
        /padding:(\d+)px;background:#1C1916">\s*<div style="display:grid;grid-template-columns:([^;"]+);gap:(\d+)px/g,
      ),
    ].map((match) => ({
      padding: Number(match[1]),
      columns: match[2] as string,
      gap: Number(match[3]),
    }));

    const [frame, second] = drawn;

    expect(drawn).toHaveLength(2);
    expect(frame).toEqual(second);
    expect(frame?.columns).toBe('1.5fr 1fr 1fr 1fr');

    const { container } = render(await SiteFooter());
    const box = container.querySelector('[data-slot="site-footer"] > div');
    const grid = box?.firstElementChild;
    const classes = grid?.className.split(/\s+/) ?? [];

    /*
     * The frame's numbers on Tailwind's 4px scale. Only the vertical padding is
     * this ticket's: the horizontal half is the page's own gutter ladder, which
     * already reached the frame's 40px at 1440.
     */
    expect(box?.className.split(/\s+/) ?? []).toContain(`py-${(frame?.padding ?? 0) / 4}`);
    // The template, verbatim — underscores are Tailwind's space.
    expect(classes).toContain(`lg:grid-cols-[${frame?.columns.replaceAll(' ', '_')}]`);
    // Four equal quarters put `Browse` at x=390 against the frame's 493.
    expect(classes).not.toContain('lg:grid-cols-4');

    // The gap holds on the outer grid and on the nav that spans three of it.
    const gap = `gap-${(frame?.gap ?? 0) / 4}`;
    expect(classes).toContain(gap);
    expect(
      container.querySelector('nav[aria-label="Footer"]')?.className.split(/\s+/) ?? [],
    ).toContain(gap);
  });

  /*
   * #441, style axis. Every number here is read out of the frame and resolved
   * through the type scale, because the deviations this ticket closed are all
   * half-steps: 13.5px for 13, a 10px row gap for 11, 1.6 leading for 1.5. An
   * assertion that names the built utility without deriving it passes equally
   * well against the value the ticket was filed to remove.
   *
   * The micro-labels are deliberately left at `text-label`: see the comment on
   * `LINK_CLASS` for why this frame's `.lbl` restyle is the outlier.
   */
  it('sets the link columns and the tagline at the frame’s own steps', async () => {
    const frame = deltaFrame('delta-band');
    // Three columns per footer, twice over, and all six must agree.
    const columns = [
      ...frame.matchAll(/flex-direction:column;gap:(\d+)px;font-size:(\d+)px;color:#B8AF9F/g),
    ].map((match) => ({ gap: Number(match[1]), size: Number(match[2]) }));
    // The tagline states a ratio; the legal row's 12px states none.
    const taglines = [
      ...frame.matchAll(/font:400 (\d+)px\/([\d.]+) 'Instrument Sans',sans-serif;color:#8C8375/g),
    ].map((match) => ({ size: Number(match[1]), leading: match[2] }));

    expect(columns).toHaveLength(6);
    expect(new Set(columns.map((column) => JSON.stringify(column))).size).toBe(1);
    expect(taglines).toHaveLength(2);
    expect(taglines[0]).toEqual(taglines[1]);

    const { container } = render(await SiteFooter());

    /*
     * On the list, not on the link. A row's height is the `li`'s own line box,
     * and a smaller inline child does not shrink it — 13px on the anchor alone
     * left every row a 20px box against the frame's 16, and the footer 25px
     * taller than it draws. Asserting the anchor carries NO size utility is
     * what makes this fail if the size is ever moved back onto it.
     */
    const [column] = columns;

    for (const list of container.querySelectorAll('nav[aria-label="Footer"] ul')) {
      const classes = list.className.split(/\s+/);

      expect(classes).toContain(typeStepFor(column?.size ?? 0));
      // 11px on Tailwind's 4px scale. `gap-2.5` is the 10px this replaced.
      expect(classes).toContain(`gap-${(column?.gap ?? 0) / 4}`);
    }

    for (const link of container.querySelectorAll('nav[aria-label="Footer"] a')) {
      const classes = link.className.split(/\s+/);

      expect(classes.filter((name) => /^text-(?!stone-)/.test(name))).toEqual([]);
      // The one row the frame lifts to `stone-50` belongs to the test below.
      if (link.textContent !== 'Contact support') {
        expect(classes).toContain('text-stone-520');
      }
    }

    // The legal row is the same mechanism at the frame's own smaller step.
    const legal = [
      ...frame.matchAll(/font:400 (\d+)px 'Instrument Sans',sans-serif;color:#8C8375/g),
    ].map((match) => Number(match[1]));

    expect(new Set(legal)).toEqual(new Set([12]));
    expect(
      container.querySelector('[data-slot="footer-legal"] ul')?.className.split(/\s+/) ?? [],
    ).toContain(typeStepFor(legal[0] ?? 0));

    /*
     * The gap between the lockup and the tagline. Matched through the mark's
     * own fill and its `#F8F5EF` stroke, so the design document's masthead —
     * which draws the same two circles over the ink at a different margin — is
     * not mistaken for a footer lockup.
     */
    const lockups = [
      ...frame.matchAll(
        /margin-bottom:(\d+)px">\s*<div style="[^"]*">\s*<div style="[^"]*background:#B4552F[^"]*">\s*<\/div>\s*<div style="[^"]*solid #F8F5EF/g,
      ),
    ].map((match) => Number(match[1]));

    expect(new Set(lockups)).toEqual(new Set([12]));
    expect(
      container.querySelector('[data-slot="site-footer"] p')?.className.split(/\s+/) ?? [],
    ).toContain(`mt-${(lockups[0] ?? 0) / 4}`);

    /*
     * The tagline is the brand column's paragraph, outside the nav. Its 1.5 is
     * Tailwind's own `leading-normal`, which `theme.css` records as the reason
     * the ratio gets no token of its own — so the assertion is that it is NOT
     * `leading-prose`, the 1.6 this replaced.
     */
    const tagline = container.querySelector('[data-slot="site-footer"] p');
    const taglineClasses = tagline?.className.split(/\s+/) ?? [];

    expect(tagline?.textContent).toBe(BRAND_TAGLINE);
    expect(taglineClasses).toContain(typeStepFor(taglines[0]?.size ?? 0));
    expect(taglines[0]?.leading).toBe('1.5');
    expect(taglineClasses).toContain('leading-normal');
    expect(taglineClasses).not.toContain('leading-prose');

    /*
     * The 600/0.05em micro-label is held against this frame's 500/0.07em — read
     * off the rendered heading, not off the source, so reordering two utilities
     * cannot fail a test about type size.
     */
    expect(
      container.querySelector('nav[aria-label="Footer"] p')?.className.split(/\s+/) ?? [],
    ).toEqual(expect.arrayContaining(['text-label', 'font-semibold', 'tracking-label']));
  });

  /*
   * #441. Both footers in the frame draw every link at `400 #B8AF9F` and
   * `Contact support` alone at `600 #F8F5EF` — the resting state of the others'
   * hover. It is the one row that is a way out of a problem.
   */
  it('draws Contact support at the frame’s emphasis, and nothing else', async () => {
    authState = 'signed-in';
    currentRole = 'customer';
    const { container } = render(await SiteFooter());

    const emphasised = [...container.querySelectorAll('nav[aria-label="Footer"] a')].filter(
      (link) => link.className.split(/\s+/).includes('font-semibold'),
    );

    expect(emphasised.map((link) => link.textContent)).toEqual(['Contact support']);

    /*
     * Both halves, and the second is the one that broke: `text-stone-50` and
     * `text-stone-520` are the same utility, so appending the emphasis to the
     * base class string left the row bold in the unemphasised colour. `cn`
     * merges them; asserting the loser's absence is what makes this fail if it
     * is ever concatenated again.
     */
    const classes = emphasised[0]?.className.split(/\s+/) ?? [];
    expect(classes).toContain('text-stone-50');
    expect(classes).not.toContain('text-stone-520');
  });

  /*
   * #441, colour axis — the mechanism #430 fixed in the band, in the place it
   * survived. The frame draws `rgba(248,245,239,.1)`, which is `stone-50`; the
   * row had `stone-0` (`#fffdf9`), a surface value that is not on this ground's
   * ramp at all.
   */
  it('draws the legal hairline from the ramp’s own end, not from a surface token', async () => {
    const drawn = new Set(
      [...deltaFrame('delta-band').matchAll(/border-top:1px solid rgba\(([\d, .]+)\)/g)].map(
        (match) => match[1],
      ),
    );

    /*
     * 248,245,239 is `stone-50`; `stone-0` is #fffdf9 and would be 255,253,249.
     * The token's own value is `theme-tokens.test.ts`'s to guard — this is the
     * call site, the same split the admin header's guard makes.
     */
    expect(drawn).toEqual(new Set(['248,245,239,.1']));

    const { container } = render(await SiteFooter());
    const classes =
      container.querySelector('[data-slot="footer-legal"]')?.className.split(/\s+/) ?? [];

    expect(classes).toContain('border-stone-50/10');
    expect(classes).not.toContain('border-stone-0/10');
  });

  /*
   * #430. The footer sits flush to the same 40px gutter as every block above
   * it — the page container is the one centred measure, and nothing inside it
   * adds a second. Asserted the same way as the closing band's, because a
   * recomposition of one is the change most likely to reintroduce the other.
   */
  it('gives the footer no centred measure inside the page gutter', async () => {
    const { container } = render(await SiteFooter());

    const footer = container.querySelector('[data-slot="site-footer"]');
    const [gutter, ...inner] = [...(footer?.querySelectorAll('*') ?? [])];

    expect(gutter?.getAttribute('class')?.split(/\s+/) ?? []).toContain('max-w-[1440px]');
    for (const node of inner) {
      const classes = node.getAttribute('class') ?? '';
      expect(classes.split(/\s+/), classes).not.toContain('mx-auto');
    }
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
