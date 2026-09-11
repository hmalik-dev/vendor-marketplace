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

export type Role = 'customer' | 'vendor';

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
 * Wait until React has taken over the server-rendered markup for a selector.
 *
 * `page.goto` resolves when the shell has loaded. The App Router streams the
 * rest of the route in afterwards and React renders it on the client, so
 * anything a spec does in that window is aimed at markup React does not own
 * yet: a `change` event reaches an input whose `onChange` is not attached, and
 * a `focus()` is dropped when the node it landed on is replaced.
 *
 * Neither failure looks like a race, which is why both were filed against the
 * product (#471). The first reads as a vendor with no photographs — measured
 * at two uploads lost in three runs on `/vendor/portfolio`, with no request
 * reaching `POST /upload/image` at all. The second reads as a field that
 * paints no focus ring, and reads it *stably*, so sampling twice agrees with
 * itself; on `/customer/profile` the input's `useId` changes from
 * `_R_7inpfivafb_-city` to `_r_0_-city` between two reads 150ms apart.
 *
 * The signal is React's own bookkeeping: it stamps `__reactFiber$…` and
 * `__reactProps$…` onto every host node it owns, so a node carrying one has
 * been hydrated rather than merely parsed. Pass a selector for an element
 * *inside* the boundary being driven — the header is interactive long before
 * the route's own content is.
 *
 * **Every** match has to be React's, not merely one of them. Mid-swap the
 * route holds both copies of the uploader at once, and a spec that acted on
 * the first React-owned node it saw hit `strict mode violation: …resolved to 2
 * elements` instead — the same race wearing a third face. Requiring the whole
 * set is what waits for the stale copy to go.
 */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  try {
    await page.waitForFunction(
      (target: string) => {
        const nodes = Array.from(document.querySelectorAll(target));

        return (
          nodes.length > 0 &&
          nodes.every((node) => Object.keys(node).some((key) => key.startsWith('__react')))
        );
      },
      selector,
      { timeout: 30_000 },
    );
  } catch (cause) {
    /*
     * A bare `waitForFunction: Timeout 30000ms exceeded` names nothing, and
     * replacing a red that lies with a red that is silent is not an
     * improvement. All three reachable causes are worth naming: the route is
     * genuinely still arriving; it redirected and the selector is not on the
     * page it landed on (a vendor with no `vendor_profiles` row is sent from
     * every `/vendor` route to the profile form); or React renamed the
     * properties this reads, in which case the predicate is permanently false
     * rather than wrong — it fails closed, but it still has to say so.
     */
    throw new Error(
      `React never took over ${selector} at ${page.url()}. Either the route did not ` +
        `finish arriving, it redirected somewhere that selector does not exist, or ` +
        `React no longer stamps __reactFiber$/__reactProps$ onto the nodes it owns.`,
      { cause },
    );
  }
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

async function pageForRole(browser: Browser, role: Role): Promise<Page> {
  const statePath = storageStatePath(role);

  if (!existsSync(statePath)) {
    throw new Error(
      `Missing ${statePath}. Regenerate it inside this lane — a copied one is ` +
        `minted against another port and is usually expired:\n` +
        `  pnpm lane:exec <ticket> -- pnpm e2e:auth ${role}`,
    );
  }

  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  rateLimited.set(page, []);
  page.on('response', (response) => {
    if (response.status() === 429) {
      rateLimited.get(page)?.push(response.url());
    }
  });

  return page;
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
export const test = base.extend<{ customerPage: Page; vendorPage: Page }>({
  /*
   * Playwright names this second parameter `use` by convention, but the name is
   * positional and free — and `use` trips `react-hooks/rules-of-hooks`, which
   * reads any bare `use(...)` as React's hook. Renaming it is cheaper and more
   * local than disabling that rule for the directory, which would also stop it
   * catching a real misuse in a spec that does render components.
   */
  customerPage: async ({ browser }, provide, testInfo) => {
    const page = await pageForRole(browser, 'customer');
    await page.goto('/bookings');
    await expectSignedIn(page);
    await provide(page);
    explainFailure(page, testInfo);
    await page.context().close();
  },

  vendorPage: async ({ browser }, provide, testInfo) => {
    const page = await pageForRole(browser, 'vendor');
    await page.goto('/vendor/dashboard');
    await expectSignedIn(page);
    await provide(page);
    explainFailure(page, testInfo);
    await page.context().close();
  },
});

export { expect };
