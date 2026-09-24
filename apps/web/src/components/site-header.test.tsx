import { cloneElement, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND_NAME } from '@vendor-marketplace/shared';

type AuthState = 'signed-in' | 'signed-out';

let authState: AuthState = 'signed-out';
let pathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/components/auth/show', () => ({
  Show: ({ when, children }: { when: AuthState; children: ReactNode }) =>
    when === authState ? children : null,
}));

vi.mock('@/components/auth/sign-out-button', () => ({
  /*
   * The sign-out control clones its one child with a click handler that
   * signs out to `redirectUrl`; the mock does the same against a spy. The
   * account menu itself is the app's own and renders for real (VEN-403).
   */
  SignOutButton: ({
    children,
    redirectUrl,
  }: {
    children: React.ReactElement<{ onClick?: () => void }>;
    redirectUrl?: string;
  }) => cloneElement(children, { onClick: () => signOut(redirectUrl) }),
}));

const signOut = vi.fn();

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

/*
 * The bell owns its own fetching and its own stream; the header's job is only
 * to place it and forward the gate read (VEN-586), so it is stubbed to
 * whether it rendered and what `gated` it was handed.
 */
const notificationBellGated = vi.fn();
vi.mock('@/components/messaging/notification-bell', () => ({
  NotificationBell: ({ gated }: { gated?: boolean }) => {
    notificationBellGated(gated);
    return <button type="button">Notifications</button>;
  },
}));

/*
 * The cross-tab sign-out listener and focus probe (VEN-699) are
 * `session-sync.test.tsx`'s; the header's job is to mount them for a signed-in
 * visitor and for nobody else, so it is stubbed to whether it rendered.
 */
vi.mock('@/components/auth/session-sync', () => ({
  SessionSync: () => <span data-testid="session-sync" />,
}));

/*
 * The `Messages` link asks the API whether any thread is unread (VEN-706).
 */
const apiCall = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => apiCall }));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));

/*
 * The role decides whether the header carries the vendor chip. It comes from
 * the local account record rather than the session, so it is mocked separately from
 * the signed-in/signed-out state above — the two can disagree, and the chip
 * must follow the record.
 */
let currentRole: 'customer' | 'vendor' | 'admin' | null = null;
let currentlyGated = false;
let currentUser: {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
} = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', avatarUrl: null };

vi.mock('@/lib/current-user', () => ({
  readUserForChrome: async () =>
    currentRole === null ? null : { ...currentUser, role: currentRole },
  // Gating logic is `notification-bell.test.tsx` and `current-user.test.ts`'s
  // own concern (VEN-586); this file only asserts the header forwards
  // whatever it reads (below).
  isTermsGatedForChrome: async () => currentlyGated,
}));

const { SiteHeader } = await import('./site-header');

describe('SiteHeader', () => {
  beforeEach(() => {
    authState = 'signed-out';
    pathname = '/';
    currentRole = null;
    currentlyGated = false;
    signOut.mockClear();
    notificationBellGated.mockClear();
    apiCall.mockReset().mockResolvedValue({ items: [], nextBefore: null, hasUnread: false });
    currentUser = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      avatarUrl: null,
    };
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

  /*
   * Roles are exclusive, and that decides where "home" is. `/` is a catalogue
   * of other vendors and `redirectVendorToDashboard` sends a vendor straight
   * back out of it, so a wordmark pointing there makes the one control every
   * screen carries a round trip through a redirect. A customer's home is the
   * marketplace, and an admin's is the console (VEN-702). Frame `30`.
   */
  it.each([
    ['vendor' as const, '/dashboard'],
    ['customer' as const, '/'],
    ['admin' as const, '/admin'],
    [null, '/'],
  ])('points the wordmark at home as a %s reads it', async (role, href) => {
    authState = role === null ? 'signed-out' : 'signed-in';
    currentRole = role;

    render(await SiteHeader());

    expect(screen.getByRole('link', { name: BRAND_NAME })).toHaveProperty(
      'href',
      `http://localhost:3000${href}`,
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
    expect(screen.queryByRole('button', { name: 'Account menu' })).toBeNull();
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

  it('mounts the session listener for a signed-in visitor and never for a signed-out one', async () => {
    authState = 'signed-out';
    const signedOut = render(await SiteHeader());
    expect(screen.queryAllByTestId('session-sync')).toHaveLength(0);
    signedOut.unmount();

    authState = 'signed-in';
    render(await SiteHeader());
    expect(screen.getAllByTestId('session-sync')).toHaveLength(1);
  });

  it('hides the marketing nav from a signed-in visitor', async () => {
    authState = 'signed-in';

    render(await SiteHeader());

    expect(screen.queryByRole('link', { name: 'Browse' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'For vendors' })).toBeNull();
  });

  /*
   * The signed-in cluster, pinned **by name** (#361). Frame `02` draws
   * `Messages` · `Bookings` · avatar, and the drift this catches is the Text
   * axis: the cluster read `Dashboard` for every role, which is neither the
   * frame's word nor — for a customer — a permitted one, since
   * `20-customer-bookings-hub.md` requires that "the word 'dashboard' appears
   * nowhere in the UI".
   */
  it('offers messages, the role-named dashboard link and the account menu when signed in', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());

    expect(screen.getByRole('link', { name: 'Messages' })).toHaveProperty(
      'href',
      'http://localhost:3000/messages',
    );
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign up' })).toBeNull();
  });

  /*
   * VEN-702: an admin lives on `/admin` and has no inbox, so the bar draws no
   * `Messages` link and no bell; a customer and a vendor keep both.
   */
  it.each([
    ['customer' as const, true],
    ['vendor' as const, true],
    ['admin' as const, false],
  ])('draws Messages and the bell for a %s: %s', async (role, drawn) => {
    authState = 'signed-in';
    currentRole = role;

    render(await SiteHeader());

    expect(screen.queryByRole('link', { name: 'Messages' }) !== null).toBe(drawn);
    expect(screen.queryByRole('button', { name: 'Notifications' }) !== null).toBe(drawn);
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeDefined();
  });

  /*
   * One control, three destinations — `/dashboard` resolves the role and
   * forwards — so no single string is true for every reader. The label is
   * therefore the role's, and it is the same word in the bar and in the drawer
   * the bar hides it into below `sm`: two copies of that decision is how one
   * destination ends up called two things.
   */
  it.each([
    ['customer' as const, 'Bookings'],
    ['vendor' as const, 'Dashboard'],
    ['admin' as const, 'Admin'],
  ])('calls the dashboard link %s -> %s', async (role, label) => {
    authState = 'signed-in';
    currentRole = role;

    render(await SiteHeader());

    /*
     * One link, not two: the drawer that holds the same control below `sm` is a
     * Radix dialog and renders its content only while open, so it is not in the
     * tree here. `header-drawer.test.tsx` covers the label it is handed.
     */
    expect(screen.getByRole('link', { name: label })).toHaveProperty(
      'href',
      'http://localhost:3000/dashboard',
    );
  });

  /*
   * VEN-413: frame `02` draws `Messages` and `Bookings` as nav links —
   * `13.5px / 500 / #4A443C` — not as ghost buttons, whose `clay-500` and
   * semibold `03-components.md` reserves for tertiary actions. Class-level
   * facts on the split list, since a substring match lets
   * `min-[90rem]:text-[13.5px]` stand in for a different step. jsdom computes
   * no styles, so the rendered colour is the browser pass's to verify.
   */
  it.each(['Messages', 'Bookings'])('draws %s in the nav-link treatment', async (name) => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());

    const classes = screen.getByRole('link', { name }).className.split(/\s+/);

    expect(classes).toEqual(
      expect.arrayContaining(['text-stone-700', 'font-medium', 'min-[90rem]:text-[13.5px]']),
    );
    // The 44px target the ghost button carried survives the restyle.
    expect(classes).toContain('min-h-11');
    expect(classes).not.toContain('text-clay-500');
    expect(classes).not.toContain('font-semibold');
  });

  /*
   * The cluster gap is 16px at 1440. Frame `02` draws 14, but frames `03`, `04`
   * and both vendor 1440 frames draw 16 for the same cluster — one frame
   * against four siblings is transcription drift (D30). 1024 draws 14 in two of
   * three frames. Below `lg` the one cluster serves both auth states and the
   * 768 frames split — `14 Landing tablet` 12, `14 Search tablet` 14 — so it
   * holds the signed-out value; this pin records the ladder, not a ruling there.
   */
  it('spaces the signed-in cluster 12 / 14 / 16px up the breakpoints', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());

    const cluster = screen.getByRole('link', { name: 'Messages' }).parentElement;
    const classes = cluster?.className.split(/\s+/) ?? [];

    expect(classes).toEqual(expect.arrayContaining(['gap-3', 'lg:gap-3.5', 'min-[90rem]:gap-4']));
  });

  /*
   * VEN-403: users never reach a provider-hosted panel. The avatar opens the app's own menu,
   * and it holds exactly four rows — nothing that leads to a provider's profile.
   * `Account settings` is the app's own page (VEN-677).
   */
  it.each([
    [
      'customer' as const,
      [
        ['My bookings', '/dashboard'],
        ['My profile', '/customer/profile'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
      ],
    ],
    [
      'vendor' as const,
      [
        ['Dashboard', '/dashboard'],
        ['Account settings', '/account/settings'],
        ['Contact support', '/support'],
      ],
    ],
    [
      'admin' as const,
      [
        ['Admin', '/admin'],
        ['Account settings', '/account/settings'],
      ],
    ],
  ])('opens a %s account menu of exactly its own rows and sign out', async (role, rows) => {
    authState = 'signed-in';
    currentRole = role;

    render(await SiteHeader());
    // jsdom has no PointerEvent, and Radix opens a menu from the keyboard too.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });

    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    const signOutItem = items[items.length - 1]!;

    expect(items.slice(0, -1).map((item) => [item.textContent, item.getAttribute('href')])).toEqual(
      rows,
    );
    expect(signOutItem.textContent).toBe('Sign out');
    expect(signOutItem.tagName).toBe('BUTTON');

    // Sign out lands signed out on `/` — criterion 2's half that jsdom can see.
    fireEvent.click(signOutItem);
    expect(signOut).toHaveBeenCalledExactlyOnceWith('/');
  });

  /*
   * #435's ruling for an ARIA menu button: Tab closes the panel and parks focus
   * on the trigger, rather than Radix swallowing the key inside an open menu.
   */
  it('closes the account menu on Tab and returns focus to the avatar', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    // A keyboard user is on the trigger when they open it; `keyDown` alone
    // does not put them there.
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // Radix settles focus after the panel unmounts, on a later tick.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  /*
   * Our record names the avatar, never the session's claims: the full name's
   * initials on the clay or sage fill, or the photo once one is set.
   */
  it('draws the avatar from our record: initials without a photo, the photo with one', async () => {
    authState = 'signed-in';
    currentRole = 'customer';
    currentUser = {
      firstName: 'Pat',
      lastName: 'Okafor',
      email: 'pat@example.com',
      avatarUrl: null,
    };

    const initials = render(await SiteHeader());
    const monogram = initials.container.querySelector('[data-slot="avatar-fallback"]');

    expect(monogram?.textContent).toBe('PO');
    expect(monogram?.className).toMatch(/\b(?:bg-clay-150|bg-sage-100)\b/);

    cleanup();

    currentUser = { ...currentUser, avatarUrl: 'https://cdn.example.com/pat.jpg' };
    const photo = render(await SiteHeader());
    const trigger = photo.getByRole('button', { name: 'Account menu' });

    expect(trigger.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/pat.jpg',
    );
    expect(trigger.querySelector('[data-slot="avatar-fallback"]')).toBeNull();
  });

  /*
   * Until the name step, the record holds the sign-up form's email-prefix
   * placeholder and no last name — a letter that is not the person's. The
   * header drew it (or `?` with no record); it draws the plain circle now.
   */
  it.each([
    ['a placeholder first name and no last name', 'customer' as const],
    ['no readable record', null],
  ])('draws no letter on the avatar for %s', async (_case, role) => {
    authState = 'signed-in';
    currentRole = role;
    currentUser = { firstName: 'pat', lastName: '', email: 'pat@example.com', avatarUrl: null };

    const { container } = render(await SiteHeader());
    const monogram = container.querySelector('[data-slot="avatar-fallback"]');

    expect(monogram).not.toBeNull();
    expect(monogram?.textContent).toBe('');
  });

  /*
   * A customer must never read the word at all, on either copy of the control.
   * The vendor rail's own first row is called `Dashboard` — frame `08` draws it
   * — so the ban is the customer's, not the product's, and asserting it here is
   * what keeps the two apart.
   */
  it('never shows a customer the word "Dashboard"', async () => {
    authState = 'signed-in';
    currentRole = 'customer';

    render(await SiteHeader());

    expect(document.body.textContent).not.toContain('Dashboard');
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

  // VEN-660: a staging page must never read as production.
  it('marks a staging build as Staging, and a production build not at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'staging');
    const { unmount } = render(await SiteHeader());
    expect(screen.getByTestId('tier-marker').textContent).toBe('Staging');
    unmount();

    vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production');
    render(await SiteHeader());
    expect(screen.queryByTestId('tier-marker')).toBeNull();
    vi.unstubAllEnvs();
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

  /*
   * VEN-586: the header only forwards `isTermsGatedForChrome`'s read — the
   * bell itself decides what to do with it.
   */
  it.each([true, false])('forwards the gate read (%s) to the notification bell', async (gated) => {
    authState = 'signed-in';
    currentRole = 'customer';
    currentlyGated = gated;

    render(await SiteHeader());

    expect(notificationBellGated).toHaveBeenCalledWith(gated);
  });

  /*
   * VEN-706. The unread cue moved off the bookings sidebar onto the header link,
   * so it is asserted here where a reader meets it.
   */
  describe('the Messages link unread cue', () => {
    it('names the link `Messages, unread` and draws the dot when a thread is unread', async () => {
      authState = 'signed-in';
      currentRole = 'customer';
      apiCall.mockResolvedValue({ items: [], nextBefore: null, hasUnread: true });

      render(await SiteHeader());

      const link = await screen.findByRole('link', { name: 'Messages, unread' });

      expect(link).toHaveProperty('href', 'http://localhost:3000/messages');
      expect(screen.getByTestId('messages-unread-dot')).toBeDefined();
      expect(apiCall).toHaveBeenCalledWith('/conversations', expect.anything());
    });

    it('is plain `Messages` with no dot when nothing is unread', async () => {
      authState = 'signed-in';
      currentRole = 'vendor';

      render(await SiteHeader());

      await waitFor(() => expect(apiCall).toHaveBeenCalled());
      expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
      expect(screen.queryByTestId('messages-unread-dot')).toBeNull();
    });

    it('issues no unread request for a signed-out visitor', async () => {
      render(await SiteHeader());

      expect(screen.queryByRole('link', { name: /Messages/ })).toBeNull();
      expect(apiCall).not.toHaveBeenCalled();
    });

    it('stays quiet for a gated session on a gate-exempt page', async () => {
      authState = 'signed-in';
      currentRole = 'customer';
      currentlyGated = true;
      pathname = '/search';

      render(await SiteHeader());

      expect(screen.getByRole('link', { name: 'Messages' })).toBeDefined();
      expect(apiCall).not.toHaveBeenCalled();
    });
  });
});
