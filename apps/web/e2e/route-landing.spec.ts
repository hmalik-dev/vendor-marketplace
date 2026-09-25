import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { BrowserContext, ConsoleMessage, Page, Response } from '@playwright/test';

import {
  VENDOR_APPLY_PATH,
  VENDOR_DETAILS_PATH,
  VENDOR_SIGN_UP_PATH,
  WAITLIST_PATH,
} from '@vendor-marketplace/shared';

import {
  DASHBOARD_LABEL_BY_ROLE,
  DASHBOARD_PATH_BY_ROLE,
  POST_SIGN_IN_PATH_BY_ROLE,
  ROLE_ROUTE_RULES,
  roleCanReach,
} from '../src/lib/role-routes';
import { resolveE2EApiUrl, resolveE2EBaseUrl } from './base-url.js';
import { AUTH_DIR, expect, storageStatePath, test } from './fixtures.js';
import { waitForHydration, waitForStreamed } from './hydration.js';
import {
  assertLoopbackOrigin,
  deleteNoRowAccount,
  mintNoRowAccount,
  signInThroughTheForm,
  type NoRowAccount,
} from './no-row-account.js';
import {
  enumerateRouteTargets,
  isSessionGated as isSessionGatedIn,
  literalRedirectDestinations,
  renderChain as renderChainIn,
  segmentFile as segmentFileIn,
  sessionGateNames,
  stripComments,
  type RouteTarget,
  type RouteTargetRoots,
} from './route-targets.js';

/**
 * Every role × every route and redirect destination lands on a rendered screen
 * (VEN-379).
 *
 * The sweep this promotes found routing correct for every established account
 * and a dead end only for the state no fixture held: a brand-new account with
 * no `users` row. So the matrix carries that state as a persona of its own, and
 * the target list is read out of the source (`route-targets.ts`) rather than
 * written here, so a route added later is covered without anyone remembering.
 *
 * Each cell is judged at the **HTTP** level first, redirect chains followed to
 * the end — a loop fails there, where a first-hop assertion would pass it — and
 * then in the page, for a rendered screen, the persona's own chrome, and a
 * clean browser: a 5xx from the app or the API, an uncaught exception or a console error
 * fails the cell even under a rendered shell (VEN-460). A cell
 * a persona must not reach is asserted as the refusal it gets, never skipped:
 * a skipped cell and a passing cell read the same in a summary.
 *
 * Run it against `next start` with the API's rate limit raised; a dev server
 * measures compile time, and a throttled run renders every cell as the 500
 * page. `e2e/README.md` has both commands.
 */

const REPO_ROOT = dirname(AUTH_DIR);

const ROOTS: RouteTargetRoots = {
  appDir: join(REPO_ROOT, 'apps/web/src/app'),
  webSourceDir: join(REPO_ROOT, 'apps/web/src'),
  sharedConstantsDir: join(REPO_ROOT, 'packages/shared/src/constants'),
  repoRoot: REPO_ROOT,
};

const TARGETS = enumerateRouteTargets(ROOTS);

/** `requireRole`, `requireCurrentUser` and every `src/lib` helper that wraps one (VEN-757). */
const SESSION_GATES = sessionGateNames(join(ROOTS.webSourceDir, 'lib'));

type SignedInRole = keyof typeof DASHBOARD_PATH_BY_ROLE;

type Persona =
  { name: 'signed-out' } | { name: SignedInRole; role: SignedInRole } | { name: 'no-row' };

/** `VENDOR_SIGN_UP_PATH` carries `?role=vendor`; the refusal match below is pathname-only. */
const VENDOR_SIGN_UP_PATHNAME = new URL(VENDOR_SIGN_UP_PATH, 'http://x').pathname;

/**
 * VEN-512's own routing, not the generic account-gate rule: a signed-out visit
 * redirects to the vendor sign-up start, and a verified no-row session with an
 * incomplete application redirects to the details screen — never through
 * `/sign-in` or `/accept-terms`, which these three screens have no use for.
 */
const VENDOR_GATE_PATHS = new Set([VENDOR_DETAILS_PATH, VENDOR_APPLY_PATH, WAITLIST_PATH]);

/** Routes that must stay open to an account still owed the Terms — `terms-gate-paths.ts`. */
const GATE_EXEMPT = new Set([
  '/terms',
  '/privacy',
  '/cookies',
  '/legal/vendor-agreement',
  '/support',
  '/accept-terms',
]);

/** The handlers that exist only to forward; landing on one is itself the defect (AC6). */
const FORWARDERS = new Set(['/after-sign-in', '/dashboard']);

const RETURN_PATH_PARAM = 'returnTo';

/**
 * A route some role is turned away from — `ROLE_ROUTE_RULES`, minus the public
 * pages whose only gate is `redirectVendorToDashboard`. That helper sends a
 * vendor on and renders for everyone else, a visitor with no session included,
 * so `/` and `/for-vendors` are read out of their source rather than listed: a
 * hand-kept exemption for `/` alone is what failed the signed-out sweep when
 * VEN-384 added the second page.
 */
function isRoleGated(target: RouteTarget): boolean {
  const file = segmentFile(target);
  if (file !== null && /\bredirectVendorToDashboard\(/.test(codeOf(file))) return false;
  return ROLE_ROUTE_RULES.some((rule) => rule.pattern.test(target.path));
}

const APP_ORIGIN = new URL(resolveE2EBaseUrl()).origin;

/** The origin the browser's own reads go to — the header bell, the message stream. */
const API_ORIGIN = new URL(resolveE2EApiUrl()).origin;

function segmentFile(target: RouteTarget): string | null {
  return segmentFileIn(target, ROOTS);
}

function renderChain(target: RouteTarget): string[] {
  return renderChainIn(target, ROOTS);
}

/** Session-gated in its render chain, through a direct gate, a wrapper or a hand-rolled one. */
function isSessionGated(target: RouteTarget): boolean {
  return isSessionGatedIn(target, ROOTS, SESSION_GATES);
}

function codeOf(file: string): string {
  return existsSync(file) ? stripComments(readFileSync(file, 'utf8')) : '';
}

/**
 * Where a route's **own** source may send a reader it admits: the literal
 * destinations its file redirects to, plus the role's two starts when it hands
 * a live session on through a helper, a forwarder or a role table lookup —
 * `/sign-in` via `redirectIfSignedIn`, `/accept-terms` via `/after-sign-in`,
 * `/vendors/apply` sending an existing vendor to `DASHBOARD_PATH_BY_ROLE`. Any other landing
 * is a bounce the source does not explain.
 */
function ownForwards(target: RouteTarget, role: SignedInRole | null): Set<string> {
  const file = segmentFile(target);
  const code = file === null ? '' : codeOf(file);
  const destinations = new Set(literalRedirectDestinations(code));
  const handsOn =
    /\b(?:redirectIfSignedIn|redirectVendorToDashboard)\(/.test(code) ||
    /\bredirect\(\s*DASHBOARD_PATH_BY_ROLE\b/.test(code) ||
    [...FORWARDERS].some((forwarder) => destinations.has(forwarder));

  if (role !== null && handsOn) {
    destinations.add(DASHBOARD_PATH_BY_ROLE[role]);
    destinations.add(POST_SIGN_IN_PATH_BY_ROLE[role]);
  }

  return destinations;
}

interface Refusal {
  to: string;
  /** The destination the refusal must carry, or `null` when it carries none. */
  returnTo: string | null;
}

/**
 * What a persona is owed at a path: the screen itself, a named refusal, or —
 * for a route whose source forwards on its own terms — either.
 */
function expectationFor(
  persona: Persona,
  target: RouteTarget,
): { renders: boolean; refusal: Refusal | null } {
  const { path } = target;

  if (persona.name === 'signed-out') {
    if (path === '/after-sign-in')
      return { renders: false, refusal: { to: '/sign-in', returnTo: null } };
    if (VENDOR_GATE_PATHS.has(path)) {
      return { renders: false, refusal: { to: VENDOR_SIGN_UP_PATHNAME, returnTo: null } };
    }
    const toSignIn = { to: '/sign-in', returnTo: path };
    return isRoleGated(target) || isSessionGated(target) || path === '/dashboard'
      ? { renders: false, refusal: toSignIn }
      : { renders: true, refusal: toSignIn };
  }

  if (persona.name === 'no-row') {
    if (GATE_EXEMPT.has(path)) return { renders: true, refusal: null };
    if (path === VENDOR_APPLY_PATH || path === WAITLIST_PATH) {
      return { renders: false, refusal: { to: VENDOR_DETAILS_PATH, returnTo: null } };
    }
    // The details screen is the one these sessions are sent to: no role renders it, they do (VEN-629).
    if (path === VENDOR_DETAILS_PATH) return { renders: true, refusal: null };
    /*
     * Every auth screen forwards a live session through `redirectIfSignedIn`, so
     * it is read out of the source rather than listed: `/forgot-password` and
     * `/reset-password` (VEN-470) do the same as `/sign-in` and were missing here.
     */
    const file = segmentFile(target);
    const forwardsSession =
      file !== null &&
      renderChain(target).some((source) => /\bredirectIfSignedIn\(/.test(codeOf(source)));
    if (
      path === '/after-sign-in' ||
      path === '/sign-in' ||
      path === '/sign-up' ||
      forwardsSession
    ) {
      return { renders: false, refusal: { to: '/accept-terms', returnTo: null } };
    }
    const toGate = { to: '/accept-terms', returnTo: path };
    return isRoleGated(target) || isSessionGated(target) || path === '/dashboard'
      ? { renders: false, refusal: toGate }
      : { renders: true, refusal: toGate };
  }

  const { role } = persona;

  // The auth screens send a live session through `/after-sign-in` to its start.
  if (path === '/after-sign-in' || path === '/sign-in' || path === '/sign-up') {
    return { renders: false, refusal: { to: POST_SIGN_IN_PATH_BY_ROLE[role], returnTo: null } };
  }
  if (path === '/dashboard') {
    return { renders: false, refusal: { to: DASHBOARD_PATH_BY_ROLE[role], returnTo: null } };
  }
  if (!roleCanReach(role, path)) {
    return { renders: false, refusal: { to: DASHBOARD_PATH_BY_ROLE[role], returnTo: null } };
  }

  return { renders: true, refusal: null };
}

/**
 * A console `error` the browser prints for a refused fetch. The refusal itself
 * is judged by the response, so a 401 the signed-out token call earns is not a
 * fault, and a 5xx is caught there rather than by this line.
 */
const RESOURCE_REFUSAL = /^Failed to load resource:/;

/**
 * What the page did wrong that its HTTP status cannot show: a request to the
 * app or to the API answered 5xx (a read behind a rendered shell — the browser
 * calls the API directly, so its origin counts), an uncaught
 * exception, or a console error. Started before the navigation and stopped
 * once React owns the route, so a fault raised while it renders is seen.
 */
function observeBrowserFaults(page: Page): { faults: string[]; stop: () => void } {
  const faults: string[] = [];

  const onResponse = (response: Response): void => {
    const url = new URL(response.url());
    if ((url.origin === APP_ORIGIN || url.origin === API_ORIGIN) && response.status() >= 500) {
      faults.push(`a request answered HTTP ${response.status()}: ${describeUrl(url)}`);
    }
  };
  const onPageError = (error: Error): void => {
    faults.push(`uncaught exception: ${error.message.split('\n')[0]}`);
  };
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() === 'error' && !RESOURCE_REFUSAL.test(message.text())) {
      faults.push(`console error: ${message.text().split('\n')[0]}`);
    }
  };

  page.on('response', onResponse);
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  return {
    faults,
    stop: () => {
      page.off('response', onResponse);
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
    },
  };
}

function describeUrl(url: URL): string {
  return `${url.pathname}${url.search}`;
}

async function landCell(
  context: BrowserContext,
  page: Page,
  persona: Persona,
  target: RouteTarget,
): Promise<string[]> {
  const cell = `${persona.name} × ${target.path}`;
  const failures: string[] = [];
  const fail = (reason: string): void => {
    failures.push(`${cell}: ${reason}  [${target.sources.join(', ')}]`);
  };

  let response;
  try {
    response = await context.request.get(target.path, {
      maxRedirects: 20,
      headers: { accept: 'text/html', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' },
    });
  } catch (error) {
    fail(`no terminal response — ${(error as Error).message.split('\n')[0]}`);
    return failures;
  }

  const status = response.status();
  const landed = new URL(response.url());
  const isHtml = (response.headers()['content-type'] ?? '').includes('text/html');
  const body = isHtml ? await response.text() : '';

  if (status === 429) {
    fail('HTTP 429 — raise RATE_LIMIT_MAX for the sweep');
    return failures;
  }
  if (status >= 500) fail(`HTTP ${status} at ${describeUrl(landed)}`);
  if (landed.origin !== APP_ORIGIN) {
    fail(`left the app for ${landed.origin}`);
  }

  /*
   * A redirect raised under a loading boundary leaves as HTTP 200 carrying a
   * meta refresh — the gated URL answers, and only the client router moves on.
   * That is the `/bookings` and `/messages` finding, and it is not terminal.
   */
  if (body.includes('id="__next-page-redirect"')) {
    fail(`streamed a redirect under HTTP ${status} instead of answering one`);
  }

  if (FORWARDERS.has(landed.pathname)) fail(`ended on the forwarder ${landed.pathname}`);

  if (target.kinds.includes('redirect') && !target.sampled && status >= 400) {
    fail(`a redirect destination answers HTTP ${status} — nothing renders there`);
  } else if (status === 404 && !target.sampled) {
    fail('HTTP 404 on a route the source defines');
  }

  const { renders, refusal } = expectationFor(persona, target);
  const stayed = landed.pathname === target.path;

  if (!stayed) {
    const matchesRefusal =
      refusal !== null &&
      landed.pathname === refusal.to &&
      (refusal.returnTo === null
        ? true
        : new URL(landed.searchParams.get(RETURN_PATH_PARAM) ?? '/', landed).pathname ===
          refusal.returnTo);

    const role = 'role' in persona ? persona.role : null;
    const sourceForwarded = renders && ownForwards(target, role).has(landed.pathname);

    if (!matchesRefusal && !sourceForwarded) {
      fail(
        refusal
          ? `landed on ${describeUrl(landed)}, expected ${refusal.to}${refusal.returnTo ? `?returnTo=${refusal.returnTo}` : ''}`
          : `bounced to ${describeUrl(landed)} from a route this persona renders`,
      );
    }
  } else if (!renders && !(!isHtml && (status === 401 || status === 403))) {
    /*
     * A route handler that is not a page — the admin CSV export — refuses in
     * place with the API's own 401 or 403, which is the refusal for a download.
     */
    fail(`rendered a route this persona must be refused (HTTP ${status})`);
  }

  if (!isHtml || failures.length > 0) {
    return failures;
  }

  /*
   * Reported from the `finally`, so a route that never renders `<main>` is
   * named by the exception or the 5xx behind it and not only by its symptom.
   */
  const observed = observeBrowserFaults(page);
  try {
    await page.goto(target.path);
    try {
      await page.waitForURL((url) => url.pathname === landed.pathname);
    } catch {
      fail(
        `the browser ended on ${new URL(page.url()).pathname}, where HTTP ended on ${landed.pathname}`,
      );
      return failures;
    }

    try {
      await expect(page.locator('#main')).toBeVisible();
      await waitForHydration(page, '#main');
    } catch {
      fail('no rendered <main>');
      return failures;
    }
  } finally {
    observed.stop();
    for (const fault of observed.faults) fail(fault);
  }

  if ((await page.locator('[data-error-screen]').count()) > 0) {
    fail('rendered the error boundary');
  }

  /*
   * The marketplace header, where the route draws it: the console and checkout
   * draw their own, and the auth screens cover it. The auth provider's signed-in and
   * signed-out branches render on the client, so these wait rather than read.
   */
  /*
   * The header streams behind its own boundary (VEN-492). React sends the real
   * one in a hidden `S:` container beside the `B:` placeholder and swaps it in
   * afterwards, so mid-swap there are two `site-header` nodes and `isVisible()`
   * fails strict mode. Nothing here is decidable until no boundary is pending.
   */
  try {
    await waitForStreamed(page);
  } catch {
    fail('a Suspense boundary was still streaming when the page was read');
    return failures;
  }

  const siteHeader = page.locator('[data-slot="site-header"]');
  if (!(await siteHeader.isVisible())) {
    return failures;
  }

  try {
    if (persona.name === 'signed-out') {
      await expect(siteHeader.getByRole('link', { name: 'Sign in' })).toBeVisible();
    } else {
      // A no-row session has no role to read, so the header falls back to the customer's chrome.
      const role = persona.name === 'no-row' ? 'customer' : persona.role;
      // A customer's bar draws the `My bookings` pill in place of the dashboard link (VEN-760).
      const [name, href] =
        role === 'customer'
          ? ['My bookings', '/bookings']
          : [DASHBOARD_LABEL_BY_ROLE[role], '/dashboard'];
      await expect(siteHeader.getByRole('link', { name, exact: true })).toHaveAttribute(
        'href',
        href,
      );
    }
  } catch {
    const links = await siteHeader.getByRole('link').allInnerTexts();
    fail(
      `the header does not wear ${persona.name} chrome — its links read ${JSON.stringify(links)}`,
    );
  }

  return failures;
}

/**
 * The storage state's first navigation reads signed-out until the auth provider's handshake
 * settles (`.claude/rules/e2e-auth.md`), so a persona is warmed until the
 * session is live before any cell counts.
 */
async function warm(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto('/dashboard');
    expect(new URL(page.url()).pathname).not.toMatch(/^\/sign-in/);
  }).toPass({ timeout: 60_000 });
}

async function sweep(context: BrowserContext, page: Page, persona: Persona): Promise<void> {
  const failures: string[] = [];

  for (const target of TARGETS) {
    failures.push(...(await landCell(context, page, persona, target)));
  }

  expect(failures, `${failures.length} failures across ${TARGETS.length} targets`).toEqual([]);
}

test.describe('route landing, every persona × every source-derived target', () => {
  test.describe.configure({ timeout: 900_000 });

  test('the matrix reaches the targets it exists for', () => {
    const paths = TARGETS.map((target) => target.path);
    expect(paths).toEqual(
      expect.arrayContaining(['/after-sign-in', '/dashboard', '/bookings', '/accept-terms']),
    );

    /*
     * VEN-590: the detector reads a hand-rolled `if (!session) redirect(…)` as a
     * gate. `VENDOR_GATE_PATHS` still decides these three cells; this pins the
     * detection a future page with the same shape relies on.
     */
    const handRolled = [...VENDOR_GATE_PATHS].map((path) => {
      const target = TARGETS.find((candidate) => candidate.path === path);
      return [path, target !== undefined && isSessionGated(target)];
    });
    expect(handRolled).toEqual([...VENDOR_GATE_PATHS].map((path) => [path, true]));

    /*
     * VEN-757: these gate only through a `src/lib` wrapper — `requireNonAdmin`,
     * `gateBookingRequest`, `gateCheckout`, `gateConfirmedBooking`. The role
     * table lists them too; this pins that the source alone reads them as gated.
     */
    const wrapped = TARGETS.filter(
      (target) => target.path === '/account/settings/close' || target.path.startsWith('/bookings/'),
    ).map((target) => [target.path, isSessionGated(target)]);
    expect(wrapped).toHaveLength(4);
    expect(wrapped).toEqual(wrapped.map(([path]) => [path, true]));
  });

  test('signed out', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await sweep(context, page, { name: 'signed-out' });
    await context.close();
  });

  for (const role of ['customer', 'vendor', 'admin'] as const) {
    test(`signed in as ${role}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      const page = await context.newPage();
      await warm(page);
      expect(new URL(page.url()).pathname, `${role} is held at the Terms gate`).not.toBe(
        '/accept-terms',
      );
      await sweep(context, page, { name: role, role });
      await context.close();
    });
  }

  /*
   * AC1: a brand-new account with no row lands on the interstitial — from
   * `/after-sign-in`, which is where signing in puts it, and from a direct
   * gated URL, which the matrix below asserts cell by cell.
   */
  test('a newly verified account with no users row', async ({ browser }) => {
    assertLoopbackOrigin(APP_ORIGIN);
    const account: NoRowAccount = await mintNoRowAccount();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      const landing = await signInThroughTheForm(page, account);

      expect(landing.pathname).toBe('/accept-terms');

      await sweep(context, page, { name: 'no-row' });
    } finally {
      await context.close();
      await deleteNoRowAccount(account);
    }
  });
});
