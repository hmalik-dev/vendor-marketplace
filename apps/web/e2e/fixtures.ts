import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { test as base, expect, type Browser, type Page, type TestInfo } from '@playwright/test';

/**
 * Walk up to the workspace root rather than counting `../`.
 *
 * `import.meta.url` is unavailable here — `apps/web` is not `"type": "module"`,
 * so Playwright transpiles these specs to CJS and `import.meta` is a syntax
 * error. A fixed relative depth would work until someone moved the file, and
 * `process.cwd()` depends on where the runner was invoked. The workspace
 * manifest is the landmark that is true from anywhere inside the repo.
 */
function workspaceRoot(from: string = __dirname): string {
  let current = from;

  for (;;) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`No pnpm-workspace.yaml above ${from} — cannot locate .auth/`);
    }

    current = parent;
  }
}

/** `.auth/` lives at the repository root, beside `scripts/`. */
export const AUTH_DIR = resolve(workspaceRoot(), '.auth');

/**
 * `admin` is here because `pnpm e2e:auth` already mints it — `DEFAULT_ROLES` in
 * `scripts/e2e-roles.mjs` has carried all three since #392 — and because the
 * console is unreachable any other way: `role = 'admin'` comes from Clerk's
 * `unsafeMetadata` at first sign-in and is immutable afterwards, so no sign-up
 * flow produces one (D27).
 */
export type Role = 'customer' | 'vendor' | 'admin';

export function storageStatePath(role: Role): string {
  return resolve(AUTH_DIR, `${role}.json`);
}

/**
 * The check that actually fires.
 *
 * A signed-out run does not look broken: Clerk redirects to `/sign-in`, that
 * page renders cleanly, the console is empty and nothing overflows. A suite
 * that asserts only on content therefore reports a confident pass against a
 * page that is not the feature. **The resolved pathname is the assertion that
 * catches it, and it catches it first** — the Clerk client signal below can lag
 * behind hydration, but the URL cannot lie about where the server sent us.
 */
export async function expectSignedIn(page: Page): Promise<void> {
  // A throttled run reaches an error page, not sign-in. Name that first, or the
  // message below blames the session for something it did not cause.
  assertNotRateLimited(page);

  await expect(
    page,
    'redirected to sign-in — the stored session is stale or wrong-port',
  ).not.toHaveURL(/\/sign-(in|up)(\?|$|\/)/);

  /*
   * 45s, for the same reason `playwright.config.ts` gives `navigationTimeout`
   * 60: the first hit on a route compiles it. `domcontentloaded` returns as
   * soon as the server's HTML lands, and the client chunks Clerk hydrates from
   * are compiled *after* that — so on a cold route this wall clock starts
   * where the navigation's generous one stopped. At 15s it timed out on a
   * fully working inbox, which is the most expensive kind of wrong answer: it
   * points the next reader at messaging instead of at the compile.
   */
  await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: 45_000 });

  const userId = await page.evaluate(() => window.Clerk?.user?.id ?? null);
  expect(userId, 'Clerk reports no signed-in user despite the stored state').not.toBeNull();
}

/**
 * Pages that saw the API refuse a request with 429.
 *
 * The API rate-limits at `RATE_LIMIT_MAX` requests a minute (120 by default),
 * and a full suite run legitimately exceeds it. When it trips, the *symptom* is
 * a page rendering the generic 500 — "Something broke on our end… We've been
 * notified" — so every assertion downstream fails against an error page while
 * nothing is actually broken. Two runs of this suite were misread as flaky
 * messaging tests before the lane's own log named the 429.
 *
 * Recording it turns that into a failure that says what to change.
 */
const rateLimited = new WeakMap<Page, string[]>();

export function assertNotRateLimited(page: Page): void {
  const hits = rateLimited.get(page) ?? [];

  if (hits.length > 0) {
    throw new Error(
      `The API rate-limited this run (HTTP 429): ${hits[0]}\n` +
        `A full E2E pass exceeds RATE_LIMIT_MAX (120/minute by default), and the ` +
        `app surfaces the refusal as a generic 500 page — so it reads as a broken ` +
        `feature rather than a throttle. Raise it for the run:\n` +
        `  RATE_LIMIT_MAX=100000 pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/api dev`,
    );
  }
}

/**
 * Start recording 429s for a page.
 *
 * The recording is only half of it: `explainFailure` is what reads the log and
 * annotates the failure, and it runs in a fixture's teardown. So a page that
 * wants the diagnosis has to be handed out **by a fixture** — which is why
 * `scriptlessAdminPage` below is one rather than a helper a spec calls.
 */
function watchForRateLimit(page: Page): Page {
  rateLimited.set(page, []);
  page.on('response', (response) => {
    if (response.status() === 429) {
      rateLimited.get(page)?.push(response.url());
    }
  });

  return page;
}

/** The stored session for a role, or the error that names how to mint one. */
function storageStateFor(role: Role): string {
  const statePath = storageStatePath(role);

  if (!existsSync(statePath)) {
    throw new Error(
      `Missing ${statePath}. Regenerate it inside this lane — a copied one is ` +
        `minted against another port and is usually expired:\n` +
        `  pnpm lane:exec <ticket> -- pnpm e2e:auth ${role}`,
    );
  }

  return statePath;
}

async function pageForRole(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStateFor(role) });

  return watchForRateLimit(await context.newPage());
}

/**
 * Attach the real cause to a failure that has already happened.
 *
 * `assertNotRateLimited` in setup only catches a throttle that trips *before*
 * the test body — and the common case is the opposite: the run exhausts the
 * budget mid-journey. Verified by running with `RATE_LIMIT_MAX=3`, where the
 * setup-only check stayed silent and the test failed on an ordinary
 * `toBeVisible`, which is precisely the misdiagnosis this exists to stop.
 *
 * Teardown is where the answer is knowable: the test's outcome is settled and
 * the response log is complete.
 */
function explainFailure(page: Page, testInfo: TestInfo): void {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  const hits = rateLimited.get(page) ?? [];
  if (hits.length === 0) {
    return;
  }

  const note =
    `This failure is almost certainly the API rate limit, not the feature. ` +
    `${hits.length} request(s) were refused with HTTP 429, the first being ${hits[0]}. ` +
    `The app renders a refusal as the generic 500 page, so the journey fails on a ` +
    `page that says "Something broke on our end" while nothing did. Re-run with:\n` +
    `  RATE_LIMIT_MAX=100000 pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/api dev`;

  testInfo.annotations.push({ type: 'rate-limited', description: note });
  console.error(`\n${note}\n`);
}

/**
 * Role fixtures. Each yields a page whose session has been *proved* live rather
 * than assumed, so a stale `.auth/` file fails here — once, with a message
 * naming the fix — instead of surfacing as a dozen unrelated assertion failures
 * deeper in a suite.
 */
type RoleFixture = (
  args: { browser: Browser },
  provide: (page: Page) => Promise<void>,
  testInfo: TestInfo,
) => Promise<void>;

/**
 * One fixture body, three roles.
 *
 * `provide` is Playwright's `use`, renamed: the name is positional and free,
 * and a bare `use(...)` trips `react-hooks/rules-of-hooks`, which reads it as
 * React's hook. Renaming is cheaper and more local than disabling that rule for
 * the directory, which would also stop it catching a real misuse in a spec that
 * does render components.
 */
function roleFixture(role: Role, landing: string): RoleFixture {
  return async ({ browser }, provide, testInfo) => {
    const page = await pageForRole(browser, role);

    await page.goto(landing);
    await expectSignedIn(page);
    await provide(page);
    explainFailure(page, testInfo);
    await page.context().close();
  };
}

export const test = base.extend<{
  customerPage: Page;
  vendorPage: Page;
  adminPage: Page;
  scriptlessAdminPage: Page;
}>({
  customerPage: roleFixture('customer', '/bookings'),
  vendorPage: roleFixture('vendor', '/vendor/dashboard'),
  adminPage: roleFixture('admin', '/admin'),

  /**
   * A signed-in console page with **JavaScript disabled**, for the paths that
   * have to work without it.
   *
   * It cannot simply load `.auth/admin.json`: Clerk's short-lived `__session`
   * JWT is refreshed by Clerk's own script, so a stored state minted more than
   * a minute ago arrives expired and the middleware answers with a handshake
   * redirect that nothing on a scriptless page can complete — the run lands on
   * `/sign-in` and reads as a broken console. So the session is **warmed** in a
   * scripted context first and the refreshed cookies are handed to the
   * scriptless one, which is the difference between a spec that measures the
   * no-JS path and one that measures Clerk.
   *
   * `/admin` is the cheapest authenticated console route and the cookie is the
   * same whichever one refreshes it, so the warm hop does not render the
   * surface under test.
   *
   * A fixture rather than a helper, so the scriptless page gets the same
   * teardown every other page here does: the 429 annotation, and a context that
   * is closed on the failing path as well as the passing one.
   */
  scriptlessAdminPage: async ({ browser }, provide, testInfo) => {
    const warmPage = await pageForRole(browser, 'admin');

    await warmPage.goto('/admin');
    await expectSignedIn(warmPage);
    const refreshed = await warmPage.context().storageState();
    await warmPage.context().close();

    const context = await browser.newContext({ storageState: refreshed, javaScriptEnabled: false });
    const page = watchForRateLimit(await context.newPage());

    await provide(page);
    explainFailure(page, testInfo);
    await context.close();
  },
});

export { expect };
