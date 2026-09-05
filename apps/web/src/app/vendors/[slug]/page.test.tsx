import { render } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();

/*
 * The page itself only needs `notFound`; `BookingRail` and `ReviewsPane` hold a
 * router, which a page-level render does not mount. Nothing on the page is
 * stubbed — but note that `ProfileTabs` renders only the active pane, and the
 * default is `about`, so `ReviewsPane`, `PackagesPane`, `PortfolioPane` and
 * `AvailabilityPane` are constructed as elements and never mounted. The
 * assertions below cover the JSON-LD, the header and the booking rail.
 */
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/vendors/hostile-studio',
  useSearchParams: () => new URLSearchParams(),
}));

/*
 * `useApi` reads a Clerk token, and a page-level render mounts no provider. The
 * request never fires in this test — nothing is clicked — so the hook only has
 * to exist.
 */
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => null, isSignedIn: false, isLoaded: true }),
}));

const getPublicVendorProfile = vi.fn();
const getPublicVendorAvailability = vi.fn();
const getPublicVendorReviews = vi.fn();

vi.mock('@/lib/vendor-data', () => ({
  getPublicVendorProfile: (slug: string) => getPublicVendorProfile(slug),
  getPublicVendorAvailability: (slug: string) => getPublicVendorAvailability(slug),
  getPublicVendorReviews: (slug: string) => getPublicVendorReviews(slug),
}));

const { default: VendorProfilePage } = await import('./page.js');

/**
 * The two payloads the sweep filed #398 on: the first closes the JSON-LD
 * element and opens a script of its own, the second closes the JSON object
 * first so a naive `JSON.stringify` would leave valid-looking JSON behind it.
 */
const BREAKOUT = '</script><script>alert(1)</script>';
const NESTED_BREAKOUT = '"}]}</script><img src=x onerror=alert(1)>';

const VENDOR = {
  id: '11111111-1111-4111-8111-111111111111',
  businessName: BREAKOUT,
  slug: 'hostile-studio',
  bio: NESTED_BREAKOUT,
  tagline: null,
  yearsInBusiness: null,
  profileImageUrl: null,
  coverImageUrl: null,
  city: 'Austin',
  state: 'TX',
  serviceRadiusKm: null,
  responseTimeHours: null,
  avgRating: 4.9,
  reviewCount: 3,
  completedEventCount: 2,
  startingPriceCents: 145_000,
  categories: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Photography', slug: 'photo' }],
  tags: [],
  packages: [],
  portfolio: [],
};

beforeEach(() => {
  getPublicVendorProfile.mockResolvedValue(VENDOR);
  getPublicVendorAvailability.mockResolvedValue([]);
  getPublicVendorReviews.mockResolvedValue({ items: [], total: 0, summary: null, viewer: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function renderPage(): Promise<HTMLElement> {
  const { container } = render(
    await VendorProfilePage({ params: Promise.resolve({ slug: 'hostile-studio' }) }),
    // `ProfileTabs` holds the open tab in the URL; the adapter lives in the
    // root layout, which a page-level render does not go through.
    { wrapper: NuqsTestingAdapter },
  );

  return container;
}

/**
 * #398, acceptance 2 — the stored-XSS half, at the surface rather than at the
 * serialiser.
 *
 * `serialiseJsonLd` has its own unit tests and `json-ld-escaping.test.ts`
 * guards that every structured-data site calls it. Neither would notice this
 * page rendering the vendor's own text somewhere else on the way out, which is
 * what the hole actually was: the most-visited public page in the product,
 * putting a vendor's business name through `dangerouslySetInnerHTML`.
 */
describe('the vendor page with a hostile business name and bio', () => {
  /*
   * **Read this with the escaping test below, which is the one that can fail.**
   *
   * jsdom cannot reproduce the breakout. React writes the block by setting
   * `innerHTML` on a `<script>` element, and the fragment parsing algorithm
   * runs in text mode for a script context — so a raw `</script>` in the value
   * becomes text here and creates no element, while a real page, where the
   * same characters arrive through the *document* parser, ends the element and
   * opens the attacker's. Swapping `serialiseJsonLd` back to `JSON.stringify`
   * leaves this assertion green and turns the escaping test red; that is a
   * property of the renderer, not of the fix.
   *
   * The test above it parses the emitted markup through a document parser and
   * is the one carrying acceptance 2. This one earns its place on the rest of
   * the page: the same hostile text reaches a heading, an avatar label and a
   * booking rail, and jsdom's fragment parser is **not** in text mode for those
   * — a `dangerouslySetInnerHTML` added to a `div` rendering vendor text would
   * build a real `<script>` here and fail this.
   */
  it('builds no element out of the payload anywhere on the page', async () => {
    const container = await renderPage();

    const scripts = [...container.querySelectorAll('script')];
    const executable = scripts.filter(
      (script) => script.getAttribute('type') !== 'application/ld+json',
    );

    expect(executable).toEqual([]);
    expect(scripts).toHaveLength(1);
    expect(container.querySelector('img[onerror]')).toBeNull();

    /*
     * Deliberately not `innerHTML.not.toContain('<script>')`. The payload does
     * appear verbatim in the markup — inside `aria-label` on the avatar and the
     * booking rail, where `<` and `>` are legal characters and inert, and where
     * React set the value through the DOM rather than by parsing markup. The
     * claim worth asserting is that nothing was *built* from it, so this looks
     * for elements instead of for text.
     */
    const withHandlers = [...container.querySelectorAll('*')].filter((element) =>
      [...element.attributes].some((attribute) => attribute.name.startsWith('on')),
    );

    expect(withHandlers).toEqual([]);
  });

  /*
   * Acceptance 2, word for word: "the rendered HTML contains no executable
   * `<script>` beyond the JSON-LD element itself".
   *
   * That is a claim about the emitted document, so this renders to markup and
   * hands the string to a **document** parser — the path a browser takes, and
   * the one that ends a script element at a raw `</script>`. Verified red
   * against a `JSON.stringify` sink, which produces two scripts here where the
   * jsdom `innerHTML` path below produces one.
   */
  it('parses back from markup as exactly one script, the JSON-LD one', async () => {
    const html = renderToStaticMarkup(
      <NuqsTestingAdapter>
        {await VendorProfilePage({ params: Promise.resolve({ slug: 'hostile-studio' }) })}
      </NuqsTestingAdapter>,
    );

    // `DOMParser` in `text/html` mode is the document parser, not the fragment
    // one — the distinction this whole file turns on. No extra dependency: the
    // jsdom test environment provides it, typed by `lib.dom`.
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const scripts = [...parsed.querySelectorAll('script')];

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.getAttribute('type')).toBe('application/ld+json');
    expect(parsed.querySelector('img[onerror]')).toBeNull();
  });

  it('keeps the payload inside the JSON-LD as data, so crawlers still read it', async () => {
    const container = await renderPage();

    const block = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(block?.textContent ?? '{}') as {
      name?: string;
      description?: string;
    };

    // Parsed back out whole: escaping the sink must not corrupt the value.
    expect(data.name).toBe(BREAKOUT);
    expect(data.description).toBe(NESTED_BREAKOUT);
  });

  /*
   * **The assertion that actually holds the line**, and the faithful reading of
   * acceptance 2: whether the rendered HTML carries an executable script is
   * decided by the characters emitted inside the element, because it is the
   * document parser that ends it early. `textContent` reads the same either
   * way, so it cannot tell the two apart. Verified red against a
   * `JSON.stringify` sink before this landed.
   */
  it('escapes the angle brackets in the emitted markup', async () => {
    const container = await renderPage();
    const raw = container.querySelector('script[type="application/ld+json"]')?.innerHTML ?? '';

    expect(raw).toContain('\\u003c/script\\u003e');
    expect(raw).not.toContain('</script>');
  });

  it('renders the business name as text, not as markup', async () => {
    const container = await renderPage();
    const heading = container.querySelector('h1');

    expect(heading?.textContent).toContain(BREAKOUT);
    expect(heading?.querySelector('script')).toBeNull();
  });
});

/**
 * #409, and the hole the change to `AvailabilityPane` opened before it landed.
 *
 * The pane became a client component so it could re-anchor "today" on the
 * visitor's clock. Props handed to a client component are serialized into the
 * page's flight payload and inlined in the HTML — so passing it the
 * `Availability` rows put the vendor's **private per-date `note`** ("Sarah &
 * Tom, deposit paid") into the source of a public, unauthenticated page, for
 * any visitor or crawler to read. It renders nothing, which is exactly why no
 * assertion about the rendered output would have caught it.
 *
 * The pane now takes the keyed `date -> status` projection the booking rail
 * already took. This walks the element tree the page returns — props, not
 * markup, because props are what gets serialized — and asserts the note is not
 * in it. The prop type is the first guard; this is the one that survives
 * somebody widening the prop type.
 */
describe('a private availability note', () => {
  const NOTE = 'Sarah and Tom, deposit paid';

  /**
   * Every string anywhere in the tree — keys as well as values, because a
   * `Record<date, status>` carries its dates as keys and both halves are
   * serialized alike.
   */
  function propStrings(node: unknown, seen = new Set<unknown>()): string[] {
    if (typeof node === 'string') {
      return [node];
    }
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return [];
    }
    seen.add(node);

    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => [
      key,
      ...propStrings(value, seen),
    ]);
  }

  it('never reaches the public page’s client props', async () => {
    getPublicVendorAvailability.mockResolvedValue([
      { id: 'av-1', vendorId: 'ven-1', date: '2099-06-20', status: 'blocked', note: NOTE },
    ]);

    const tree = await VendorProfilePage({ params: Promise.resolve({ slug: 'hostile-studio' }) });

    // The projection did reach the page — otherwise this asserts nothing.
    expect(propStrings(tree)).toContain('2099-06-20');
    expect(propStrings(tree)).not.toContain(NOTE);
  });
});
