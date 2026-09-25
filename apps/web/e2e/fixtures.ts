import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

import { test as base, expect, type Browser, type Page, type TestInfo } from '@playwright/test';

import { recordExchanges } from './request-log.js';

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

const run = promisify(execFile);

/**
 * `packages/db`'s test-only date control, run as a child process.
 *
 * A child rather than an import because specs cannot load that package (see
 * `fixtures-data.ts`), and a command rather than an API route because moving a
 * paid event into the past is a write no deployed surface may be able to make.
 * The script refuses a production database exactly as `seed:e2e` does, and it
 * inherits this process's environment — under `lane:exec`, the lane database.
 */
async function e2eDates(args: readonly string[]): Promise<{ eventDate: string }> {
  const { stdout } = await run(
    'pnpm',
    ['--silent', '--filter', '@vendor-marketplace/db', 'e2e:dates', ...args],
    { cwd: workspaceRoot() },
  );
  const parsed: unknown = JSON.parse(stdout.trim().split('\n').at(-1) ?? '');

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('eventDate' in parsed) ||
    typeof parsed.eventDate !== 'string'
  ) {
    throw new Error(`e2e:dates ${args.join(' ')} printed no eventDate: ${stdout}`);
  }

  return { eventDate: parsed.eventDate };
}

/**
 * A date the E2E vendor has nothing on, chosen at random from a window starting
 * 120 days out. `seed:e2e` tops up rather than resets, so a fixed date would be
 * booked by the first run and refused on every run after it.
 */
export async function freshEventDate(): Promise<string> {
  return (await e2eDates(['fresh-date'])).eventDate;
}

/** Moves a booking's event to yesterday (UTC), so it can be marked complete. */
export async function shiftBookingIntoPast(bookingId: string): Promise<string> {
  return (await e2eDates(['shift-past', bookingId])).eventDate;
}

export type Role = 'customer' | 'vendor' | 'admin';

export function storageStatePath(role: Role): string {
  return resolve(AUTH_DIR, `${role}.json`);
}

/**
 * The check that actually fires.
 *
 * A signed-out run does not look broken: the app redirects to `/sign-in`, that
 * page renders cleanly, the console is empty and nothing overflows. A suite
 * that asserts only on content therefore reports a confident pass against a
 * page that is not the feature. **The resolved pathname is the assertion that
 * catches it, and it catches it first** — the token check below is a second
 * opinion, but the URL cannot lie about where the server sent us.
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
   * The session cookie is httpOnly, so the page cannot read it; it asks the
   * app's own token route instead, which answers 200 only for a session Neon
   * Auth still recognises. A stored state whose cookie expired redirects at the
   * assertion above, and one whose session was revoked fails here.
   */
  const token = await pageToken(page);
  expect(token, 'the app holds no session token despite the stored state').not.toBeNull();
}

/**
 * The bearer token for the page's signed-in session, or `null`.
 *
 * Straight after a navigation the answer is the same as any later one — there
 * is no client to wait on — so nothing here needs a load signal, unlike the
 * provider globals this replaced.
 */
export async function pageToken(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const response = await fetch('/api/session/token', { cache: 'no-store' });
    return response.ok ? (((await response.json()) as { token?: string }).token ?? null) : null;
  });
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

/** Each role page's request log (`request-log.ts`), attached when its test fails. */
const exchanges = new WeakMap<Page, string[]>();

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
  exchanges.set(page, recordExchanges(page));

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
async function explainFailure(page: Page, role: Role, testInfo: TestInfo): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  await testInfo.attach(`${role} requests`, {
    body: (exchanges.get(page) ?? []).join('\n'),
    contentType: 'text/plain',
  });

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
    await explainFailure(page, 'customer', testInfo);
    await page.context().close();
  },

  vendorPage: async ({ browser }, provide, testInfo) => {
    const page = await pageForRole(browser, 'vendor');
    await page.goto('/vendor/dashboard');
    await expectSignedIn(page);
    await provide(page);
    await explainFailure(page, 'vendor', testInfo);
    await page.context().close();
  },
});

export { expect };
