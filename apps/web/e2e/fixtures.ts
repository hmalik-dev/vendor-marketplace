import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { test as base, expect, type Browser, type Page } from '@playwright/test';

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
  await expect(
    page,
    'redirected to sign-in — the stored session is stale or wrong-port',
  ).not.toHaveURL(/\/sign-(in|up)(\?|$|\/)/);

  await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: 15_000 });

  const userId = await page.evaluate(() => window.Clerk?.user?.id ?? null);
  expect(userId, 'Clerk reports no signed-in user despite the stored state').not.toBeNull();
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

  return context.newPage();
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
  customerPage: async ({ browser }, provide) => {
    const page = await pageForRole(browser, 'customer');
    await page.goto('/bookings');
    await expectSignedIn(page);
    await provide(page);
    await page.context().close();
  },

  vendorPage: async ({ browser }, provide) => {
    const page = await pageForRole(browser, 'vendor');
    await page.goto('/vendor/dashboard');
    await expectSignedIn(page);
    await provide(page);
    await page.context().close();
  },
});

export { expect };
