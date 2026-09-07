import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import {
  BRAND_NAME,
  CATEGORY_SEEDS,
  LANDING_CATEGORY_COUNT,
  pageTitle,
  type Category,
  type VendorCard as VendorCardData,
} from '@vendor-marketplace/shared';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

const redirectVendorToDashboard = vi.fn<() => Promise<void>>();
const getCategories = vi.fn<() => Promise<Category[]>>();
const getFeaturedVendors = vi.fn<() => Promise<VendorCardData[]>>();

/*
 * The page's composition turns on the *role*, not only on whether a session
 * exists: a signed-in customer gets the status strip and loses the acquisition
 * sections, while an operator — who also holds a session — gets the visitor's
 * page. Mocked separately from `authState` above for the same reason
 * `site-footer.test.tsx` does it: the two can disagree, and the page has to
 * follow the record rather than the session.
 */
let currentRole: 'customer' | 'vendor' | 'admin' | null = null;
const getOwnBookingRequests = vi.fn<() => Promise<WireBookingRequest[]>>();
const getOwnBookings = vi.fn<() => Promise<WireBooking[]>>();

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

vi.mock('@/lib/current-user', () => ({
  redirectVendorToDashboard: () => redirectVendorToDashboard(),
  readRoleForChrome: async () => currentRole,
}));

vi.mock('@/lib/customer-data', () => ({
  getOwnBookingRequests: () => getOwnBookingRequests(),
  getOwnBookings: () => getOwnBookings(),
}));

vi.mock('@/lib/vendor-data', () => ({
  getCategories: () => getCategories(),
  getFeaturedVendors: () => getFeaturedVendors(),
}));

/**
 * The bar itself is `SearchBar`'s to test — it holds a client-side router. The
 * page's contract is only that the hero carries one.
 */
vi.mock('@/components/landing/hero-search', () => ({
  HeroSearch: () => <div data-testid="hero-search" />,
}));

const { default: HomePage, metadata, dynamic } = await import('./page');

/*
 * The page renders a signed-in customer's own rows — their next vendor's name,
 * the event date and the amount Stripe is holding — so its HTML is per-viewer
 * and must never be shareable. It is dynamic anyway, by inheritance from two
 * `auth()` calls it does not own; this asserts the route *says so*, which is
 * what survives a refactor of either of those. Raised by the security audit on
 * #428; every peer route rendering per-user data already declares it.
 */
describe('the landing route', () => {
  it('is never prerendered, because it renders the reader own bookings', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});

/** The taxonomy as the API returns it: every seed, with ids and `isActive`. */
function apiCategories(): Category[] {
  return CATEGORY_SEEDS.map((seed, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index.toString(36)}`,
    name: seed.name,
    slug: seed.slug,
    description: seed.description,
    icon: seed.icon,
    displayOrder: seed.displayOrder,
    isActive: true,
  }));
}

function vendor(overrides: Partial<VendorCardData> = {}): VendorCardData {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    businessName: 'Kessler & Co.',
    slug: 'kessler-co',
    city: 'Austin',
    state: 'TX',
    profileImageUrl: null,
    coverImageUrl: null,
    avgRating: 4.9,
    reviewCount: 127,
    startingPriceCents: 145_000,
    isNew: false,
    categories: [{ id: 'cat-1', name: 'Photography', slug: 'photography' }],
    ...overrides,
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    authState = 'signed-out';
    currentRole = null;
    redirectVendorToDashboard.mockResolvedValue(undefined);
    getCategories.mockResolvedValue(apiCategories());
    getFeaturedVendors.mockResolvedValue([vendor()]);
    getOwnBookingRequests.mockResolvedValue([]);
    getOwnBookings.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('leads with the two-line headline and the launch-market badge', async () => {
    render(await HomePage());

    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe('Book your vendorswithout the back-and-forth.');
    expect(screen.getByText('Now booking in Austin')).toBeDefined();
  });

  /*
   * #85. Frame `01 Landing` draws the hero badge at 12px. It carried
   * `text-xs`, which is 11px in this theme, and the 12px step it wanted
   * already existed as `--text-meta` — it had just never been moved onto it.
   */
  it('sizes the hero badge on the 12px step the frame draws it at', async () => {
    render(await HomePage());

    const badge = screen.getByText(/Now booking in/).closest('p');

    expect(badge?.className).toContain('text-meta');
    expect(badge?.className).not.toContain('text-xs');
  });

  it('puts a search bar in the hero, so a visitor can start without scrolling', async () => {
    render(await HomePage());

    expect(screen.getByTestId('hero-search')).toBeDefined();
  });

  it('jumps straight to four categories instead of the old free-text link row', async () => {
    render(await HomePage());

    expect(screen.getByText('Or jump straight to')).toBeDefined();
    // The four and their order were ruled with #419, when Florals left the
    // taxonomy and Beauty took its slot.
    for (const [name, slug] of [
      ['Photography', 'photography'],
      ['Catering', 'catering'],
      ['Entertainment', 'entertainment'],
      ['Beauty', 'beauty'],
    ]) {
      expect(screen.getAllByRole('link', { name })[0]).toHaveProperty(
        'href',
        `http://localhost:3000/search?category=${slug}`,
      );
    }
  });

  /*
   * The order is rendered, not incidental: the row is read left to right and
   * the ruling named a sequence. Asserting each link separately above proves
   * every one is present and points somewhere real; this proves the row.
   */
  it('renders the jump row in the ruled order, and no longer offers Florals', async () => {
    const { container } = render(await HomePage());

    const row = screen.getByText('Or jump straight to').parentElement;
    expect(row).not.toBeNull();

    expect([...row!.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Photography',
      'Catering',
      'Entertainment',
      'Beauty',
    ]);
    expect(container.querySelector('a[href="/search?category=florals"]')).toBeNull();
  });

  it('features the six categories the frame draws, in displayOrder', async () => {
    render(await HomePage());

    const cards = screen.getAllByRole('heading', { level: 3 });
    const featured = CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT);

    expect(cards.slice(0, LANDING_CATEGORY_COUNT).map((card) => card.textContent)).toEqual(
      featured.map((category) => category.name),
    );
    for (const category of featured) {
      expect(screen.getByText(category.shortDescription), category.slug).toBeDefined();
    }
  });

  /*
   * Frame `01` was revised on 2026-08-27: the clay glyph circle became a 94px
   * cover photograph clipped by the card radius. These six are the only
   * photography the platform owns — every vendor-side cover stays a labelled
   * placeholder, so a test that finds stock art on a vendor card is a
   * regression, not a feature.
   */
  it('draws each featured category as its photograph', async () => {
    render(await HomePage());

    const grid = screen.getByRole('list', { name: 'Browse by category' });
    const images = within(grid).getAllByRole('presentation', { hidden: true });

    expect(images).toHaveLength(LANDING_CATEGORY_COUNT);

    for (const [index, seed] of CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT).entries()) {
      // `next/image` rewrites `src` through its loader, so the assertion is on
      // the path it was asked to load, which is what has to stay slug-keyed.
      expect(images[index]?.getAttribute('src'), seed.slug).toContain(
        encodeURIComponent(`/categories/${seed.slug}.jpg`),
      );
    }
  });

  it('leaves the category photographs decorative', async () => {
    render(await HomePage());

    const grid = screen.getByRole('list', { name: 'Browse by category' });

    // The category name sits directly beneath each image, so alt text would be
    // read twice — the same reasoning `StockPhoto` documents.
    for (const image of within(grid).getAllByRole('presentation', { hidden: true })) {
      expect(image.getAttribute('alt')).toBe('');
    }
  });

  /*
   * The card has no glyph fallback any more, so a category promoted into the
   * landing six without a photograph ships a broken image. That is a content
   * gap rather than a styling one, and this is where it is caught: promoting a
   * seventh category, or renaming a slug, fails here and names the file to add.
   */
  /*
   * The guard above reads `CATEGORY_SEEDS`; this one reads what the API
   * actually returns, which is the half that can disagree with it.
   *
   * A database seeded before #419 still holds a live `florals` row at
   * `display_order` 5 until `pnpm db:seed` runs, and that row would take the
   * fifth card — pointing at a category the picker no longer offers and asking
   * for `/categories/florals.jpg`, which this ticket renamed. The card has no
   * image fallback, so it renders broken on the front door.
   */
  it('drops a category the seeds no longer describe, however the API orders it', async () => {
    getCategories.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-0000000000ff',
        name: 'Florals',
        slug: 'florals',
        description: 'Retired by #419, still live in an unseeded database.',
        icon: 'flower',
        displayOrder: 5,
        isActive: true,
      },
      ...apiCategories(),
    ]);

    const { container } = render(await HomePage());

    const grid = screen.getByRole('list', { name: 'Browse by category' });
    expect(within(grid).queryByRole('heading', { name: 'Florals' })).toBeNull();
    expect(container.querySelector('img[src*="florals.jpg"][sizes*="15vw"]')).toBeNull();

    // And the row is still six cards, not five with a hole where it was.
    expect(within(grid).getAllByRole('presentation', { hidden: true })).toHaveLength(
      LANDING_CATEGORY_COUNT,
    );
  });

  it('has a photograph on disk for every category the landing promotes', () => {
    const directory = join(process.cwd(), 'public', 'categories');

    for (const seed of CATEGORY_SEEDS.slice(0, LANDING_CATEGORY_COUNT)) {
      expect(existsSync(join(directory, `${seed.slug}.jpg`)), `missing ${seed.slug}.jpg`).toBe(
        true,
      );
    }
  });

  /*
   * A browser tab truncates from the right at roughly fifteen characters, and
   * a pinned tab shows nothing but the favicon. The landing used to spend 51
   * on a sentence, so what a visitor actually read was the brand plus three
   * words of it.
   */
  it('keeps the landing tab title short, and the sentence on the share card', () => {
    const title = (metadata.title as { absolute: string }).absolute;

    expect(title).toBe(`${BRAND_NAME} · Book event vendors`);
    expect(title.length).toBeLessThan(30);

    // The share card has room for the sentence, so it keeps it.
    expect(metadata.openGraph?.title).toBe(
      `${BRAND_NAME} — book event vendors without the back-and-forth`,
    );
  });

  /*
   * Every other page composes through `pageTitle`, which appends the brand and
   * a separator — eight characters of the budget before the page has said
   * anything of its own. This
   * walks the real titles in the route tree so a new page cannot quietly ship
   * one that truncates.
   */
  it('keeps every page title inside a tab', () => {
    const directory = join(process.cwd(), 'src', 'app');
    const sources = readdirSync(directory, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('page.tsx') && !entry.endsWith('.test.tsx'))
      .map((entry) => readFileSync(join(directory, entry), 'utf8'));

    const titles = sources.flatMap((source) =>
      Array.from(source.matchAll(/pageTitle\('([^']+)'\)/g), (match) => pageTitle(match[1])),
    );

    // If this finds nothing the test is asserting about an empty list.
    expect(titles.length).toBeGreaterThan(5);

    for (const title of titles) {
      expect(title.length, title).toBeLessThan(30);
    }
  });

  it('makes every featured category card a link into search', async () => {
    render(await HomePage());

    const grid = screen.getByRole('list', { name: 'Browse by category' });
    const links = within(grid).getAllByRole('link');

    expect(links).toHaveLength(LANDING_CATEGORY_COUNT);
    expect(links[0]).toHaveProperty('href', 'http://localhost:3000/search?category=photography');
  });

  it('holds the rest of the taxonomy back behind "All 10 categories"', async () => {
    render(await HomePage());

    expect(screen.getByRole('link', { name: 'All 10 categories →' })).toHaveProperty(
      'href',
      'http://localhost:3000/search',
    );
    for (const category of CATEGORY_SEEDS.slice(LANDING_CATEGORY_COUNT)) {
      expect(screen.queryByRole('heading', { level: 3, name: category.name })).toBeNull();
    }
  });

  /*
   * #82. Frame `01 Landing` draws this as a plain action link — a bare span at
   * padding 0 and radius 0 — but it was rendered through
   * `Button variant="ghost" size="sm"`, whose `px-3 py-1.5 rounded-md` took a
   * 16px-tall link to 29px. The pill classes are what regressed, so they are
   * what this asserts; it keeps the focus ring in the same breath, because
   * dropping the `Button` is also what dropped the ring it used to supply.
   */
  it('draws "All 10 categories" as a plain link, not a padded pill', async () => {
    render(await HomePage());

    const link = screen.getByRole('link', { name: 'All 10 categories →' });

    for (const pill of ['px-3', 'py-1.5', 'rounded-md']) {
      expect(link.className).not.toContain(pill);
    }
    /*
     * #383. The ring is the base `:focus-visible` rule's, not this link's — an
     * unbordered control writes nothing. What still matters here is that the
     * link is *reachable*: dropping the `Button` is what dropped the ring, and
     * a hand-rolled copy is now the regression rather than the fix.
     */
    expect(link.className).not.toContain('focus-visible:ring-');
    expect(link.getAttribute('data-focus-own')).toBeNull();
  });

  /*
   * #86. Frame `01 Landing` draws this link at 13px; it rendered at 12.5px
   * (`text-sm`) because the scale had no 13px step until `--text-action`.
   */
  it('sizes the categories link on the 13px step the frame draws it at', async () => {
    render(await HomePage());

    const link = screen.getByRole('link', { name: 'All 10 categories →' });

    expect(link.className).toContain('text-action');
    expect(link.className).not.toContain('text-sm');
  });

  it('counts nothing in the badge or on a category card', async () => {
    render(await HomePage());

    // The badge used to read "412 vendors in Austin" and the cards "64 vendors
    // · from $850". Both are deferred until the numbers are real, so neither
    // may carry a digit at all — design/design-plan/98-post-mvp.md.
    expect(screen.getByText('Now booking in Austin').textContent).not.toMatch(/\d/);

    const grid = screen.getByRole('list', { name: 'Browse by category' });
    for (const card of within(grid).getAllByRole('listitem')) {
      expect(card.textContent, card.textContent ?? '').not.toMatch(/\d/);
    }
  });

  it('ships no stats band, because the trust section does that work', async () => {
    const { container } = render(await HomePage());

    expect(container.textContent).not.toMatch(/events booked|average rating|median reply/i);
  });

  it('drops the featured row entirely rather than inventing vendors', async () => {
    getFeaturedVendors.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.queryByRole('heading', { name: 'Featured vendors' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Browse by category' })).toBeDefined();
  });

  /*
   * The hero cluster is the composition, and it only reads as one beside the
   * headline — so it is drawn wherever a frame gives it a column beside the
   * copy, and dropped where none does.
   *
   * **This replaces the old "below `lg`" rule**, which #304's new
   * `14 Landing tablet` frame overrides: that frame draws two cards beside a
   * narrower copy column at 768. The reasoning behind the old rule still holds
   * below 768, where the hero really is one column and `14 Landing mobile`
   * draws no cards at all — so the cutoff moved from `lg` to `md` rather than
   * disappearing.
   */
  it('draws the hero cluster from md, where a frame gives it a column', async () => {
    const { container } = render(await HomePage());

    // next/image rewrites src through the optimiser, so this matches the
    // encoded original rather than the literal path.
    const cluster = container.querySelector('img[src*="florals.jpg"]');
    expect(cluster).not.toBeNull();

    const clusterColumn = cluster?.closest('div.hidden');
    expect(clusterColumn?.className).toContain('hidden');
    expect(clusterColumn?.className).toContain('md:flex');
    // And not still gated on `lg`, which would leave 768 empty.
    expect(clusterColumn?.className).not.toContain('lg:flex');

    // The category cards are a different row and are not gated on width.
    const categoryCard = container.querySelector('img[src*="categories%2Fphotography.jpg"]');
    expect(categoryCard?.closest('div.hidden')).toBeNull();
  });

  /*
   * `14 Landing mobile` draws no cards, so the third card's own gate has to
   * survive: it is the one the tablet frame sheds, and it must not reappear at
   * 768 just because the cluster now renders there.
   */
  it('still sheds the third card below lg, as the tablet frame draws it', async () => {
    const { container } = render(await HomePage());

    // `StockPhoto` puts the caller's classes on its wrapper, not the `img`.
    const venue = container.querySelector('img[src*="venue.jpg"]')?.parentElement;
    expect(venue).not.toBeNull();
    expect(venue?.className).toContain('hidden');
    expect(venue?.className).toContain('lg:block');
  });

  /*
   * `30-responsive.md`: a control that gains responsibility at 1024 must fit
   * at 1024, and if it cannot, the widths change rather than the content. The
   * hero gutter is the frame's 34px at the design target and narrower at `lg`,
   * which is the 18px the search bar needed for "Any vendor type".
   */
  /*
   * `27 Landing — 1024` draws the copy column's right inset at 22px and `01
   * Landing` at 34px. This used to assert `lg:pr-4` (16px) with the wide step
   * on `xl` — but `xl` is 1280, a width nothing in the bundle draws, so the
   * 1440 value started 160px early and 1024 got a number from neither frame.
   */
  it('insets the hero copy column at each width the frames draw one', async () => {
    const { container } = render(await HomePage());
    const copyColumn = container.querySelector('[class*="lg:pr-5.5"]');

    expect(copyColumn, 'no hero copy column carrying the 1024 inset').not.toBeNull();
    expect(copyColumn?.className).toContain('min-[90rem]:pr-8.5');
    expect(copyColumn?.className, 'the 1440 inset must not start at 1280').not.toContain('xl:pr-');
  });

  it('still renders the front door when the taxonomy is unavailable', async () => {
    // `getCategories` degrades to `[]` rather than throwing — the hero and its
    // search bar must survive a bad day on `/categories`. See ticket #33.
    getCategories.mockResolvedValue([]);

    render(await HomePage());

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Browse by category' })).toBeNull();
    expect(screen.queryByRole('link', { name: /All 0 categories/ })).toBeNull();
  });

  it('names the three steps and the three trust signals below the fold', async () => {
    render(await HomePage());

    for (const step of ['Discover', 'Book', 'Celebrate']) {
      expect(screen.getByRole('heading', { level: 3, name: step }), step).toBeDefined();
    }
    for (const signal of [
      'Reviews from real bookings',
      'Payment held until the event',
      'No service fee',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: signal }), signal).toBeDefined();
    }
  });

  /*
   * The closing band is vendor-only now. The customer half was redundant — the
   * hero is a *live search bar*, so a button whose only job is to scroll you
   * back up to it earns nothing.
   */
  it('closes the visitor page with the vendor band and its three mechanism steps', async () => {
    render(await HomePage());

    expect(screen.getByRole('heading', { name: 'Booking events yourself?' })).toBeDefined();
    for (const step of ['Publish your prices', 'Set your open dates', 'Get paid after the event']) {
      expect(screen.getByRole('heading', { name: step }), step).toBeDefined();
    }
    // The half that came off, and the control that went with it.
    expect(screen.queryByText('Planning an event?')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Find a vendor' })).toBeNull();
  });

  /*
   * Both controls **and** the nav link share one destination. A band whose
   * headline CTA and whose "how it works" link disagree is two doors into one
   * room. `/for-vendors` does not exist yet, so the documented fallback is the
   * signup form with the role pre-selected — 21-sign-up.md.
   */
  it('points both band controls at one vendor destination', async () => {
    render(await HomePage());

    for (const name of ['Start taking bookings', 'See how payouts work']) {
      expect(screen.getByRole('link', { name }), name).toHaveProperty(
        'href',
        'http://localhost:3000/sign-up?role=vendor',
      );
    }
  });

  /*
   * Asserted against the **rendered output**, not the source: the figure could
   * arrive through a shared constant, and a source scan would not see it.
   *
   * Commission is a conversion number, not an acquisition one, and customers
   * read this same page — a percentage here invites the reader to conclude a
   * vendor charges more here than direct, which undercuts *No service fee*
   * three sections above.
   */
  it('puts no pricing figure in the closing band', async () => {
    render(await HomePage());

    const band = document.querySelector('#for-vendors');

    expect(band).not.toBeNull();
    expect(band?.textContent).not.toMatch(/\d+\s*%|\$\d/);
    expect(band?.textContent).not.toMatch(/business day/i);
  });

  it('never shows the closing band to somebody who already holds a session', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await HomePage());

    expect(document.querySelector('#for-vendors')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Start taking bookings' })).toBeNull();
  });

  /*
   * #430. The band was two columns — a capped pitch on the left and the steps
   * in a right-hand column behind a vertical rule — which left roughly 500px
   * of dead ink on the right. It stacks now: the pitch and its controls hold
   * the top line, a hairline crosses the full width, and the three steps run
   * beneath it as equal thirds — the closing-band frame in
   * `design/delta-band/`.
   *
   * Class-level facts, per `.claude/rules/web-design-parity.md`: jsdom lays
   * nothing out, so the rendered composition is the parity pass's to confirm.
   */
  it('stacks the closing band, so the steps run the full width beneath the pitch', async () => {
    render(await HomePage());

    /*
     * The top line is what holds the pitch and the controls on one row and
     * pushes the button to the outer edge. Without these three the band
     * renders as a single vertical stack with the button flush left — a
     * composition every other assertion in this file still passes on, because
     * the steps' grid, the rule and the DOM order of the two controls are all
     * unchanged by it.
     */
    const topLine = document.querySelector('#for-vendors > div > div');
    const topLineClasses = topLine?.getAttribute('class')?.split(/\s+/) ?? [];

    for (const token of ['sm:flex-row', 'sm:items-end', 'sm:justify-between']) {
      expect(topLineClasses, token).toContain(token);
    }

    const steps = document.querySelector('#for-vendors ol');
    const stepClasses = steps?.className.split(/\s+/) ?? [];

    expect(stepClasses).toContain('sm:grid-cols-3');
    // The vertical rule the columned version divided its two halves with.
    expect(stepClasses).not.toContain('sm:border-l');

    // The hairline that replaced it spans the band, not one column of it.
    const rule = document.querySelector('#for-vendors [data-slot="band-rule"]');
    expect(rule?.className.split(/\s+/) ?? []).toContain('h-px');
  });

  /*
   * #430, from the parity pass. The pitch and the numerals set their type on
   * the band's ink, and they were reaching for `stone-400` — a **border**
   * value, drawn on a light ground at thirty-nine sites across the frames and
   * as text on ink at none. The ramp was missing the role rather than the
   * value being three units out, so `stone-480` was added beside the other
   * three ink-ground text steps; `theme.css` carries the derivation and
   * `theme-tokens.test.ts` its contrast.
   */
  it('sets the band pitch and numerals in the ink-ground text ramp, not a border value', async () => {
    render(await HomePage());

    const inked = [
      document.querySelector('#for-vendors > div > div p'),
      document.querySelector('#for-vendors ol span'),
    ];

    for (const node of inked) {
      const classes = node?.getAttribute('class')?.split(/\s+/) ?? [];
      expect(classes, node?.textContent ?? '').toContain('text-stone-480');
      expect(classes, node?.textContent ?? '').not.toContain('text-stone-400');
    }
  });

  /*
   * The words are the design. The closing-band frame and its brief both write
   * step three as "released through Stripe"; the superseded
   * `LANDING-BAND-CHANGE-PROMPT.md` is the only place in `design/` carrying
   * the extra "to you", and it is what the band had shipped.
   */
  it('writes the third step the way the frame does', async () => {
    render(await HomePage());

    expect(
      screen.getByText(
        'The payment is held from booking until the event is done, then released through Stripe.',
      ),
    ).toBeDefined();
  });

  /*
   * The button goes last, so the strongest control in the band sits at the
   * page's own gutter rather than behind a text link.
   */
  it('puts the band link before its button, leaving the button outermost', async () => {
    render(await HomePage());

    const controls = [...document.querySelectorAll('#for-vendors a')].map(
      (node) => node.textContent,
    );

    expect(controls).toEqual(['See how payouts work', 'Start taking bookings']);
  });

  /*
   * The band used to wrap its contents in a centred inner measure, defended by
   * a comment in `page.tsx`: two blocks left uncapped sit at opposite edges and
   * stop reading as one band. The stacked composition removes the condition
   * that argued for it — there are no longer two blocks to hold together — and
   * the newer frame draws the contents flush to the page's own 40px gutter,
   * which every block above the band is already left-aligned to.
   *
   * The page container is the one centred element here, because it *is* the
   * page's measure. Nothing inside it may add a second one.
   */
  it('gives the band no centred measure inside the page gutter', async () => {
    render(await HomePage());

    const gutter = document.querySelector('#for-vendors > div');

    expect(gutter?.getAttribute('class')?.split(/\s+/) ?? []).toContain('max-w-[1440px]');
    for (const node of gutter?.querySelectorAll('*') ?? []) {
      const classes = node.getAttribute('class') ?? '';
      expect(classes.split(/\s+/), classes).not.toContain('mx-auto');
    }
  });

  /*
   * The comment that defended the capped measure was specific and persuasive
   * enough to get this change reverted by the next reader, so it is corrected
   * rather than orphaned — and the width it argued for is gone from the file
   * entirely, comment included, which is what this asserts. The replacement
   * comment deliberately does not quote the old number, so this guard can
   * still fail.
   */
  it('leaves no trace of the capped measure the band used to centre', async () => {
    const source = readFileSync(join(process.cwd(), 'src', 'app', 'page.tsx'), 'utf8');

    expect(source).not.toMatch(/1160/);
  });

  it('describes the page to crawlers as a local business in the live market', async () => {
    const { container } = render(await HomePage());

    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}');

    expect(data['@type']).toBe('LocalBusiness');
    expect(data.name).toBe(BRAND_NAME);
    expect(data.areaServed).toMatchObject({ '@type': 'City', name: 'Austin' });
  });

  it('anchors both header nav destinations, so neither link lands nowhere', async () => {
    const { container } = render(await HomePage());

    // The header's "How it works" and "For vendors" are absolute anchors into
    // this page; if either id is renamed the nav silently stops scrolling.
    expect(container.querySelector('#how-it-works')).not.toBeNull();
    expect(container.querySelector('#for-vendors')).not.toBeNull();
  });

  it('never renders the marketplace when the guard redirects a vendor', async () => {
    redirectVendorToDashboard.mockRejectedValue(new Error('NEXT_REDIRECT:/vendor/dashboard'));

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(getCategories).not.toHaveBeenCalled();
  });
});

/*
 * The six category cards are the front door's primary navigation, and they
 * shipped with **no focus indicator of any kind** — no outline, no ring, just
 * the resting shadow. `globals.css` declares the ring once for anything
 * focusable, which is why this went unnoticed: the global rule exists, and the
 * card's own `shadow-sm` composition was what left nothing on screen.
 *
 * Asserted as a class-level fact, deliberately. jsdom computes no ring, and
 * `04-laws.md`'s Access axis is settled by the parity pass in a real browser —
 * see `.claude/rules/web-design-parity.md`. What this catches is the utilities
 * going missing again; that the ring actually *paints* is the browser's to say.
 */
describe('the category cards are reachable by keyboard', () => {
  /* Its own fixtures: the suite above leaves the redirect guard rejecting. */
  beforeEach(() => {
    authState = 'signed-out';
    currentRole = null;
    redirectVendorToDashboard.mockResolvedValue(undefined);
    getCategories.mockResolvedValue(apiCategories());
    getFeaturedVendors.mockResolvedValue([vendor()]);
    getOwnBookingRequests.mockResolvedValue([]);
    getOwnBookings.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("leaves every category card to the law's own focus ring", async () => {
    const { container } = render(await HomePage());

    /*
     * Scoped to the category grid, not to the href — the four hero jump chips
     * point at the same `/search?category=` URLs. Those are pills with no
     * shadow of their own, and the global `:focus-visible` rule reaches them;
     * the cards are the ones it did not.
     */
    const grid = container.querySelector('ul[aria-labelledby="categories-heading"]');
    expect(grid, 'no category grid').not.toBeNull();

    const cards = [...(grid as HTMLElement).querySelectorAll('a')];
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      /*
       * #383. The card carried its own copy of the unbordered treatment, at
       * `/30` where both `03-components.md` and `04-laws.md` say `/40` — the
       * drift that made the same idiom render differently from screen to
       * screen. The base rule in `globals.css` is that treatment now, so the
       * card writes nothing and does not opt out of it, and
       * `e2e/focus-indicator.spec.ts` proves the ring paints and is not clipped
       * by the card's own `overflow-hidden`.
       */
      expect(card.className, 'a category card restates the base focus ring').not.toContain(
        'focus-visible:ring-',
      );
      expect(card.getAttribute('data-focus-own')).toBeNull();

      /* Chrome's own outline must not be left as the only indicator either. */
      expect(card.className).toContain('outline-none');
    }
  });
});

/*
 * The signed-in landing — the same route, and a different page below the hero.
 *
 * A vendor never reaches any of this: `redirectVendorToDashboard` sends them to
 * their own dashboard before the page renders, which `current-user.test.ts`
 * covers and the test at the end of this block asserts is still called first.
 * The reader here is a customer.
 */
describe('HomePage, signed in as a customer', () => {
  const EVENT_DATE = '2226-06-14';

  function request(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
    return {
      id: 'req-1',
      customerId: 'cus-1',
      vendorId: 'ven-1',
      packageId: 'pkg-1',
      eventDate: EVENT_DATE,
      eventStartTime: null,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion',
      guestCount: 120,
      customDetails: null,
      status: 'accepted',
      quotedPriceCents: null,
      quoteNote: null,
      finalPriceCents: 205_000,
      expiresAt: null,
      createdAt: new Date('2026-04-26T12:00:00Z'),
      updatedAt: new Date('2026-04-26T12:00:00Z'),
      vendor: {
        id: 'ven-1',
        slug: 'june-harlow',
        businessName: 'June Harlow Photography',
        city: 'Austin',
        state: 'TX',
        avatarUrl: null,
        categoryName: 'Photography',
        avgRating: 4.9,
        reviewCount: 127,
      },
      package: null,
      ...overrides,
    } as WireBookingRequest;
  }

  function booking(overrides: Partial<WireBooking> = {}): WireBooking {
    return {
      id: 'bok-1',
      requestId: 'req-1',
      customerId: 'cus-1',
      vendorId: 'ven-1',
      eventDate: EVENT_DATE,
      eventLocation: 'Barr Mansion',
      totalAmountCents: 205_000,
      status: 'confirmed',
      paidAt: new Date('2026-04-26T12:00:00Z'),
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: new Date('2026-04-26T12:00:00Z'),
      updatedAt: new Date('2026-04-26T12:00:00Z'),
      eventType: 'wedding',
      venue: 'Barr Mansion',
      ...overrides,
    } as WireBooking;
  }

  beforeEach(() => {
    authState = 'signed-in';
    currentRole = 'customer';
    redirectVendorToDashboard.mockResolvedValue(undefined);
    getCategories.mockResolvedValue(apiCategories());
    getFeaturedVendors.mockResolvedValue([vendor()]);
    getOwnBookingRequests.mockResolvedValue([]);
    getOwnBookings.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /* The hero is byte-identical to the visitor's. Re-cutting it is a separate
   * decision, and this is what says it has not been made here. */
  it('leaves the hero exactly as the visitor sees it', async () => {
    getOwnBookings.mockResolvedValue([booking()]);
    getOwnBookingRequests.mockResolvedValue([request()]);

    render(await HomePage());

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Book your vendorswithout the back-and-forth.',
    );
    expect(screen.getByTestId('hero-search')).toBeDefined();
    expect(screen.getByText('Now booking in Austin')).toBeDefined();
  });

  it('drops the acquisition sections, leaving the trust band as the ending', async () => {
    render(await HomePage());

    expect(screen.queryByRole('heading', { name: 'How it works' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Featured vendors' })).toBeNull();
    expect(document.querySelector('#for-vendors')).toBeNull();

    /* The trust band stays, and is the last content block on the page. */
    const sections = [...document.querySelectorAll('section')];
    const trust = document.querySelector('section[aria-labelledby="trust-heading"]');

    expect(trust).not.toBeNull();
    expect(sections.at(-1)).toBe(trust);
  });

  /*
   * The ramp into the footer: hero gradient → `stone-50` → `stone-100` trust
   * band → `stone-950` footer, each step darker than the last. On `stone-50`
   * the footer would arrive as a hard cut off cream.
   */
  it('puts the trust band on stone-100 so the footer arrives as the bottom of a ramp', async () => {
    render(await HomePage());

    expect(document.querySelector('section[aria-labelledby="trust-heading"]')?.className).toContain(
      'bg-stone-100',
    );
  });

  /*
   * Ruled 2026-09-07: the band is generic in both auth states. It used to
   * resolve against the reader's own booking — "Your $2,050 for June Harlow
   * Photography is held by Stripe until…" — and this asserts the reversal
   * rather than merely dropping the old test, because a customer WITH a
   * booking is exactly the case that would regress.
   */
  it('keeps the trust band generic even for a customer who has a booking', async () => {
    getOwnBookings.mockResolvedValue([booking()]);
    getOwnBookingRequests.mockResolvedValue([request()]);

    render(await HomePage());

    expect(
      screen.getByText(
        'Stripe holds your payment until your event is complete, then releases it to the vendor.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/Your \$2,050 for June Harlow Photography/)).toBeNull();
    expect(screen.queryByText(/You can review June Harlow Photography once/)).toBeNull();
  });

  /*
   * The `Next up` strip was removed on 2026-09-07. The reason is the one worth
   * guarding: **a customer can have several upcoming bookings**, so a single
   * "next up" states as fact a choice the data does not make. The hub already
   * shows all of them without having to pick one.
   *
   * Asserted with a customer who HAS bookings and open requests, because the
   * empty case would pass against the strip too.
   */
  it('renders no status strip, even for a customer with bookings and open requests', async () => {
    getOwnBookings.mockResolvedValue([booking()]);
    getOwnBookingRequests.mockResolvedValue([
      request(),
      request({ id: 'req-2', status: 'pending' }),
    ]);

    render(await HomePage());

    expect(screen.queryByRole('region', { name: 'Your bookings at a glance' })).toBeNull();
    expect(document.body.textContent).not.toContain('Next up');
    expect(document.body.textContent).not.toContain('waiting on a vendor');
  });

  /*
   * An operator holds a session too, and gets the *visitor's* page: they have
   * no bookings to summarise and are looking at the marketplace rather than at
   * their own things. The band still goes, because that is a session question.
   */
  it('gives an operator the visitor composition, minus the band', async () => {
    currentRole = 'admin';

    render(await HomePage());

    expect(screen.getByRole('heading', { name: 'How it works' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Featured vendors' })).toBeDefined();
    expect(document.querySelector('#for-vendors')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Your bookings at a glance' })).toBeNull();
    expect(getOwnBookings).not.toHaveBeenCalled();
  });

  /*
   * #33's law: a public route must render for a signed-in visitor even when the
   * API will not answer them. The two hub reads do not honour it on their own —
   * `customerToken()` redirects when Clerk hands back no token, and
   * `degradeToEmpty` redirects on a 401 before it can return its empty list.
   * Both are right for `/bookings`; here they would bounce a customer whose JWT
   * the API rejects off the marketing home to `/sign-in?returnTo=/`, and back
   * again on arrival.
   *
   * A `NEXT_REDIRECT` rejection is the shape those raise, and it is the case
   * the wholesale module mock hid.
   */
  it.each([
    ['a redirect out of the reads', new Error('NEXT_REDIRECT:/sign-in?returnTo=%2F')],
    ['an upstream that failed outright', new Error('boom')],
  ])('still renders the landing page when the hub answers with %s', async (_label, failure) => {
    getOwnBookings.mockRejectedValue(failure);
    getOwnBookingRequests.mockRejectedValue(failure);

    render(await HomePage());

    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    // Degraded to the visitor's guarantees rather than to no page at all.
    expect(
      screen.getByText(
        'Stripe holds your payment until your event is complete, then releases it to the vendor.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Your bookings at a glance' })).toBeNull();
  });

  /*
   * The featured row is off for this reader, so fetching it is a round trip
   * whose result is discarded — on the one page whose own comment measures what
   * this wave costs.
   */
  it('does not fetch the featured row it will not render', async () => {
    render(await HomePage());

    expect(getFeaturedVendors).not.toHaveBeenCalled();
  });

  /*
   * The redirect runs before anything else on this route, so a vendor never
   * renders the marketing page at all. Its own behaviour is
   * `current-user.test.ts`'s; what this pins is that the page still asks.
   */
  it('sends a vendor away before it renders anything', async () => {
    redirectVendorToDashboard.mockRejectedValue(new Error('NEXT_REDIRECT:/vendor/dashboard'));

    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(getCategories).not.toHaveBeenCalled();
  });
});
