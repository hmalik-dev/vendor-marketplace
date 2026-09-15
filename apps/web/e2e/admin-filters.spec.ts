import { test as base, type Browser, type Page } from '@playwright/test';

import { expect, expectSignedIn, storageStatePath } from './fixtures.js';

/**
 * The console's `Apply filters` submit (VEN-383).
 *
 * Two defects, reported on `/admin/reviews` and present on every Refine bar:
 *
 * 1. **It discarded the filters it is named for.** The dropdowns navigate on
 *    change and are not form controls, so the GET form had no successful
 *    controls and activating the submit landed on the bare path.
 * 2. **Its hidden box sat on the first control.** `sr-only` is
 *    `position:absolute` with no offsets, so the 1px box resolved to the flex
 *    container's content start, on top of the `Direction` combobox.
 *
 * The control exists for the keyboard and no-JS path, so a mouse test cannot
 * fail for either. These drive it with Tab and Enter, and once with JavaScript
 * off. They read the rows, not only the URL: the query is what the browser
 * asked for, the table is what the server answered.
 *
 * The admin pages are built here rather than in `fixtures.ts`, which another
 * lane owns; they reuse its session check.
 */

const PATH = '/admin/reviews';

/** The direction filtered on, and the word its rows print in the `About` column. */
const DIRECTION = {
  type: 'vendor_to_customer',
  option: 'About a customer',
  about: 'The customer',
} as const;

const FILTERED = `${PATH}?type=${DIRECTION.type}`;

async function adminContextPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath('admin') });
  const page = await context.newPage();
  await page.goto('/admin');
  await expectSignedIn(page);

  return page;
}

const test = base.extend<{ adminPage: Page; scriptlessAdminPage: Page }>({
  // `provide` is Playwright's `use`, renamed: a bare `use(...)` trips
  // `react-hooks/rules-of-hooks`. Same reason as `fixtures.ts`.
  adminPage: async ({ browser }, provide) => {
    const page = await adminContextPage(browser);
    await provide(page);
    await page.context().close();
  },

  /*
   * JavaScript off. Clerk's short-lived `__session` is refreshed by Clerk's own
   * script, so a stored state loaded straight into a scriptless context arrives
   * expired and lands on a handshake nothing can complete. The session is
   * warmed in a scripted context and its refreshed cookies handed over.
   */
  scriptlessAdminPage: async ({ browser }, provide) => {
    const warm = await adminContextPage(browser);
    const refreshed = await warm.context().storageState();
    await warm.context().close();

    const context = await browser.newContext({ storageState: refreshed, javaScriptEnabled: false });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

interface Listing {
  /** `<n> total` from the surface heading — how many rows the server matched. */
  total: number;
  /** How many rows the table drew. */
  rows: number;
  /** The distinct values in the `About` column, found by its header text. */
  directions: string[];
}

async function listing(page: Page): Promise<Listing> {
  return page.evaluate(() => {
    const count = [...document.querySelectorAll('p')]
      .map((node) => /^(\d+) total\b/.exec(node.textContent?.trim() ?? ''))
      .find((match) => match !== null);

    if (!count) {
      throw new Error('no "<n> total" in the surface heading');
    }

    const [header, ...rows] = [...document.querySelectorAll('[role="row"]')];
    const column = [...(header?.children ?? [])].findIndex(
      (cell) => cell.textContent?.trim().toLowerCase() === 'about',
    );

    if (column === -1) {
      throw new Error('the reviews table has no About column');
    }

    return {
      total: Number(count[1]),
      rows: rows.length,
      directions: [...new Set(rows.map((row) => row.children[column]?.textContent?.trim() ?? ''))],
    };
  });
}

/** Tab until the submit holds focus, the way a keyboard user reaches it. */
async function tabToSubmit(page: Page): Promise<void> {
  for (let stop = 0; stop < 40; stop += 1) {
    await page.keyboard.press('Tab');

    const landed = await page.evaluate(
      () => document.activeElement?.textContent?.trim() === 'Apply filters',
    );

    if (landed) {
      return;
    }
  }

  throw new Error('40 Tab presses never reached the Apply filters submit');
}

/**
 * Activate the submit and return the document request it issued.
 *
 * Waited for, not inferred: the page is already on `?type=…` when the key is
 * pressed, so a URL assertion alone would pass against a submit that sent
 * nothing at all.
 */
async function submitAndAwaitDocument(page: Page): Promise<string> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().isNavigationRequest() &&
        candidate.request().method() === 'GET' &&
        new URL(candidate.url()).pathname === PATH,
    ),
    page.keyboard.press('Enter'),
  ]);

  expect(response.status()).toBe(200);
  await page.waitForLoadState('domcontentloaded');

  const landed = new URL(response.url());

  return `${landed.pathname}${landed.search}`;
}

async function expectSubmitKeepsTheFilter(page: Page, before: Listing): Promise<void> {
  expect(await submitAndAwaitDocument(page)).toBe(FILTERED);
  await expect(page).toHaveURL(FILTERED);

  const after = await listing(page);
  expect(after.total).toBe(before.total);
  expect(after.rows).toBe(before.rows);
  expect(after.directions).toEqual([DIRECTION.about]);
}

/**
 * The unfiltered listing, having proved it holds both directions.
 *
 * `seed:e2e` writes one completed booking reviewed in each direction (VEN-395),
 * so this holds on a lane with no manual precondition. With one direction only,
 * the filter removes nothing and every assertion below would pass against a bar
 * that still discards the query — which is why it is asserted, not assumed.
 */
async function unfilteredBaseline(page: Page): Promise<Listing> {
  await page.goto(PATH);
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));

  const unfiltered = await listing(page);

  expect(
    unfiltered.directions.length,
    `${PATH} shows reviews in one direction only (${unfiltered.directions.join(', ') || 'none'}), ` +
      `so the Direction filter cannot be observed to narrow anything. Re-run the fixture seed:\n` +
      `  pnpm lane:exec <n> -- pnpm db:seed:e2e`,
  ).toBeGreaterThan(1);

  return unfiltered;
}

function expectNarrowed(filtered: Listing, unfiltered: Listing): void {
  expect(filtered.total).toBeGreaterThan(0);
  expect(filtered.total).toBeLessThan(unfiltered.total);
  expect(filtered.directions).toEqual([DIRECTION.about]);
}

/** The element a click aimed at this one's centre would reach. */
async function elementAtOwnCentre(page: Page, which: 'active' | 'submit'): Promise<string> {
  return page.evaluate((selector) => {
    const target =
      selector === 'active'
        ? document.activeElement
        : [...document.querySelectorAll('form button[type="submit"]')].find(
            (button) => button.textContent?.trim() === 'Apply filters',
          );

    if (!target) {
      return 'nothing to measure';
    }

    const box = target.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

    if (hit === target) {
      return 'itself';
    }

    // Only a control in the same bar is interception; an ordinary container
    // under a hidden box is what `sr-only` should produce.
    return hit && hit.closest('form') === target.closest('form')
      ? `${hit.tagName}: ${hit.textContent?.trim().slice(0, 40)}`
      : 'nothing in the bar';
  }, which);
}

test.describe('the console Refine bar', () => {
  test('keyboard end to end: choose a direction, tab to the submit, and it keeps the filter', async ({
    adminPage,
  }) => {
    const unfiltered = await unfilteredBaseline(adminPage);

    const trigger = adminPage.getByRole('button', { name: 'Direction' });
    await trigger.focus();
    await adminPage.keyboard.press('Enter');
    await expect(adminPage.getByRole('option', { name: DIRECTION.option })).toBeVisible();

    for (let stop = 0; stop < 5; stop += 1) {
      const active = await adminPage.evaluate(() => {
        const id = document.activeElement?.getAttribute('aria-activedescendant');
        const node = id ? document.getElementById(id) : document.activeElement;

        return node?.textContent?.trim() ?? '';
      });

      if (active === DIRECTION.option) {
        break;
      }

      await adminPage.keyboard.press('ArrowDown');
    }

    await adminPage.keyboard.press('Enter');
    await expect(adminPage).toHaveURL(FILTERED);
    await expect(adminPage.getByRole('button', { name: DIRECTION.option })).toBeVisible();

    const filtered = await listing(adminPage);
    expectNarrowed(filtered, unfiltered);

    await tabToSubmit(adminPage);
    await expectSubmitKeepsTheFilter(adminPage, filtered);
  });

  test('applies the filter with JavaScript switched off, which is what the submit is for', async ({
    scriptlessAdminPage,
  }) => {
    const unfiltered = await unfilteredBaseline(scriptlessAdminPage);

    await scriptlessAdminPage.goto(FILTERED);
    const filtered = await listing(scriptlessAdminPage);
    expectNarrowed(filtered, unfiltered);

    // No change handler exists on this page; the query survives only because
    // the form carries it as fields.
    await tabToSubmit(scriptlessAdminPage);
    await expectSubmitKeepsTheFilter(scriptlessAdminPage, filtered);
  });

  test('the hidden submit covers no control at 1440x900, and is hit-testable once focused', async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await adminPage.goto(FILTERED);
    await expect(adminPage).toHaveURL(FILTERED);

    /*
     * `'nothing in the bar'`, not `'itself'`: `sr-only`'s `clip` removes the
     * hidden box from hit testing, so it can neither be clicked nor steal a
     * click. Before the fix it resolved onto the `Direction` combobox.
     */
    expect(await elementAtOwnCentre(adminPage, 'submit')).toBe('nothing in the bar');

    // Focused is the state a user reaches it in, and there it is a real target.
    await tabToSubmit(adminPage);
    expect(await elementAtOwnCentre(adminPage, 'active')).toBe('itself');

    // Unforced: Playwright refuses a click on a point another element owns.
    await adminPage.getByRole('button', { name: 'Apply filters' }).click();
    await expect(adminPage).toHaveURL(FILTERED);
  });
});
