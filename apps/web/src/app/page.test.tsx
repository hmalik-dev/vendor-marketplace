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
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';

const redirectVendorToDashboard = vi.fn<() => Promise<void>>();
const getCategories = vi.fn<() => Promise<Category[]>>();
const getFeaturedVendors = vi.fn<() => Promise<VendorCardData[]>>();

vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

vi.mock('@/lib/current-user', () => ({
  redirectVendorToDashboard: () => redirectVendorToDashboard(),
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

const { default: HomePage, metadata } = await import('./page');

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
    categories: [{ id: 'cat-1', name: 'Photography', slug: 'photography' }],
    ...overrides,
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    authState = 'signed-out';
    redirectVendorToDashboard.mockResolvedValue(undefined);
    getCategories.mockResolvedValue(apiCategories());
    getFeaturedVendors.mockResolvedValue([vendor()]);
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
    for (const [name, slug] of [
      ['Photography', 'photography'],
      ['Florals', 'florals'],
      ['Catering', 'catering'],
      ['Entertainment', 'entertainment'],
    ]) {
      expect(screen.getAllByRole('link', { name })[0]).toHaveProperty(
        'href',
        `http://localhost:3000/search?category=${slug}`,
      );
    }
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

  it('holds the rest of the taxonomy back behind "All 11 categories"', async () => {
    render(await HomePage());

    expect(screen.getByRole('link', { name: 'All 11 categories →' })).toHaveProperty(
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
  it('draws "All 11 categories" as a plain link, not a padded pill', async () => {
    render(await HomePage());

    const link = screen.getByRole('link', { name: 'All 11 categories →' });

    for (const pill of ['px-3', 'py-1.5', 'rounded-md']) {
      expect(link.className).not.toContain(pill);
    }
    expect(link.className).toContain('focus-visible:ring-2');
  });

  /*
   * #86. Frame `01 Landing` draws this link at 13px; it rendered at 12.5px
   * (`text-sm`) because the scale had no 13px step until `--text-action`.
   */
  it('sizes the categories link on the 13px step the frame draws it at', async () => {
    render(await HomePage());

    const link = screen.getByRole('link', { name: 'All 11 categories →' });

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

  it('offers the vendor half of the split CTA to a visitor with no session', async () => {
    render(await HomePage());

    // Every vendor CTA arrives with the role pre-selected — 21-sign-up.md.
    expect(screen.getByRole('link', { name: 'Join as a vendor' })).toHaveProperty(
      'href',
      'http://localhost:3000/sign-up?role=vendor',
    );
    expect(screen.queryByRole('link', { name: 'Go to your dashboard' })).toBeNull();
  });

  it('never offers sign-up to somebody who already holds a session', async () => {
    authState = 'signed-in';

    render(await HomePage());

    expect(screen.queryByRole('link', { name: 'Join as a vendor' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
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
    redirectVendorToDashboard.mockResolvedValue(undefined);
    getCategories.mockResolvedValue(apiCategories());
    getFeaturedVendors.mockResolvedValue([vendor()]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /** The four utilities `04-laws.md` names, in the order it names them. */
  const RING = [
    'focus-visible:ring-2',
    'focus-visible:ring-clay-400/30',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-stone-50',
  ] as const;

  it("gives every category card the law's focus ring", async () => {
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
      for (const utility of RING) {
        expect(card.className, `a category card is missing \`${utility}\``).toContain(utility);
      }

      /* Chrome's own outline must not be left as the only indicator either. */
      expect(card.className).toContain('outline-none');
    }
  });

  /*
   * #296/#280's required test: a ring that computes correctly and still
   * renders nothing is exactly the failure this repo's rules warn about
   * twice over (`web-design-parity.md`, `focus-ring-guard.test.ts`) — two
   * distinct, real ways for that to happen, both checkable as class-level
   * facts without a real layout engine:
   *
   * 1. An outward ring on a element that is a *descendant* of a smaller or
   *    equal `overflow:hidden` ancestor is 100% clipped (#73's original
   *    vendor-card finding, `01/02` both). Each card here draws its own
   *    ring on the exact element that also carries `overflow-hidden` — not
   *    a child of some other clipping box — which is the one shape that
   *    can never be clipped: an element's own `overflow` does not clip its
   *    own box-shadow, only a descendant's.
   * 2. Transitioning the `box-shadow` property the ring is painted with
   *    ramps it in over `--duration-base`, so every keyboard stop reads as
   *    ring-less for the transition's whole duration — measured and fixed
   *    once already, on this exact element, per the comment beside it in
   *    `page.tsx`.
   *
   * A rendered-pixel check belongs to the browser pass, not jsdom — this
   * asserts the two structural facts a real browser needs true before a
   * geometry check could ever pass.
   */
  it('draws its ring on the same element that clips it, and never ramps it in', async () => {
    const { container } = render(await HomePage());

    const grid = container.querySelector('ul[aria-labelledby="categories-heading"]');
    const cards = [...(grid as HTMLElement).querySelectorAll('a')];
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      // The ring-bearing element is its own clip boundary, not a
      // full-bleed child of a separately-clipping ancestor.
      expect(card.className, 'ring element must carry its own overflow-hidden').toContain(
        'overflow-hidden',
      );

      // No ancestor up to the grid re-clips this element either — that
      // would be the #73 vendor-card shape reintroduced one level up.
      let ancestor = card.parentElement;
      while (ancestor && ancestor !== grid) {
        expect(
          ancestor.className,
          `${ancestor.tagName.toLowerCase()} ancestor must not itself clip the ring`,
        ).not.toContain('overflow-hidden');
        ancestor = ancestor.parentElement;
      }

      expect(
        card.className,
        'must not transition the box-shadow the ring is painted with',
      ).not.toMatch(/transition-(?:all\b|\[[^\]]*box-shadow)/);
    }
  });
});
