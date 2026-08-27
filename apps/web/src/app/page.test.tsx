import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import {
  BRAND_NAME,
  CATEGORY_SEEDS,
  LANDING_CATEGORY_COUNT,
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

const { default: HomePage } = await import('./page');

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
