import { expect, test } from './fixtures.js';

import type { Page } from '@playwright/test';

/**
 * The console's `Apply filters` submit (#455).
 *
 * Two defects, both reported on `/admin/reviews` and both present on every
 * console surface that carries a Refine bar:
 *
 * 1. **It discarded the filters it is named for.** The dropdowns navigate on
 *    change and are not form controls, so the `GET` form had no successful
 *    controls at all — activating the submit landed on the bare path.
 * 2. **It was pointer-intercepted.** `sr-only` is `position:absolute` with no
 *    offsets, so the hidden 1px box resolved to its static position — the flex
 *    container's content start — and sat on top of the first control in the
 *    bar. `elementFromPoint` at the submit's own centre returned the
 *    `Direction` combobox.
 *
 * The second is why the first survived: the control exists for the keyboard and
 * no-JS path, so **a mouse test cannot fail for either of them**. These drive it
 * the way the users it was added for do — Tab and Enter, and once with
 * JavaScript switched off entirely.
 *
 * Read the rows, not only the URL. A query string is what the browser asked
 * for; the table is what the server answered, and the defect was reported as
 * "15 rows of mixed direction" rather than as a URL.
 */

const PATH = '/admin/reviews';

/**
 * The direction filtered on, and the word its rows print in the `About` column.
 *
 * The pair is the point: `?type=vendor_to_customer` is the request and
 * `The customer` is the answer, so asserting both is what makes this a check on
 * the rows rather than on the address bar.
 */
const DIRECTION = { type: 'vendor_to_customer', about: 'The customer' } as const;

const FILTERED = `${PATH}?type=${DIRECTION.type}`;

interface Listing {
  /** `<n> total` from the surface heading — how many rows the server matched. */
  total: number;
  /** How many rows the table drew. One page of fifteen, not the whole match. */
  rows: number;
  /** The distinct values in the `About` column, found by its header. */
  directions: string[];
}

/**
 * Everything this spec asserts about the table, from one traversal.
 *
 * The count and the rows answer different halves of the question — a filter
 * that narrowed the page but not the query would pass on rows alone — and the
 * `About` column is located by its **header text** rather than by index, so
 * inserting a column ahead of it fails loudly instead of silently reading the
 * wrong cell.
 */
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
 * Activate the submit and prove the browser actually went somewhere.
 *
 * **The navigation is waited for, not inferred**, and that is the whole point
 * of this helper. The submit is activated on `?type=…` and — when it works —
 * lands back on `?type=…`, so every URL-shaped assertion after it is already
 * true of the document that was on screen before the key was pressed. A test
 * that only re-read the URL would pass against a `type="button"` that submits
 * nothing at all, which is the failure mode this file exists to catch.
 *
 * `waitForResponse` on the document request is the positive proof: it is the
 * GET the form issued, it carries the query the form built, and it is not
 * `waitForNavigation`, which Playwright deprecates as "inherently racy".
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

/**
 * The whole defect, as one claim: activating the submit re-asks for exactly the
 * filtered view the operator was already on.
 *
 * Before the fix the form's GET went to `/admin/reviews` with no query at all
 * and the table came back with every direction in it.
 */
async function expectSubmitKeepsTheFilter(page: Page, before: Listing): Promise<void> {
  expect(await submitAndAwaitDocument(page)).toBe(FILTERED);
  await expect(page).toHaveURL(FILTERED);

  const after = await listing(page);
  expect(after.total).toBe(before.total);
  expect(after.rows).toBe(before.rows);
  expect(after.directions).toEqual([DIRECTION.about]);
}

/**
 * The filtered listing, having first proved the filter removes something.
 *
 * Reviews are not part of `seed:e2e` — a review needs a completed booking, and
 * the end-to-end fixture holds a live request. Without rows in **both**
 * directions the filter has nothing to remove, so every assertion here would
 * pass against a bar that still discards the query, which is exactly the
 * "empty fixture table" shape this repository keeps being caught by.
 */
async function filteredBaseline(page: Page): Promise<Listing> {
  await page.goto(PATH);
  // The pathname first: a stale session redirects to /sign-in, which renders
  // cleanly and would pass every content-shaped assertion below.
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));

  const unfiltered = await listing(page);

  expect(
    unfiltered.directions.length,
    `${PATH} shows reviews in one direction only ` +
      `(${unfiltered.directions.join(', ') || 'none'}), so the Direction filter cannot be ` +
      `observed to narrow anything. Seed the console:\n` +
      `  pnpm lane:exec <n> -- pnpm db:seed:demo`,
  ).toBeGreaterThan(1);

  await page.goto(FILTERED);
  await expect(page).toHaveURL(FILTERED);

  const filtered = await listing(page);
  expect(filtered.total).toBeGreaterThan(0);
  expect(filtered.total).toBeLessThan(unfiltered.total);
  expect(filtered.rows).toBeGreaterThan(0);

  return filtered;
}

/** The element the browser would hand a click aimed at this one's centre. */
async function elementAtOwnCentre(page: Page, selector: 'active' | 'submit'): Promise<string> {
  return page.evaluate((which) => {
    const target =
      which === 'active'
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

    /*
     * Only a control *in the same bar* is interception. Once the hidden box is
     * anchored clear of the controls it lands on an ordinary container, which
     * is correct for something `sr-only` and not a finding.
     */
    return hit && hit.closest('form') === target.closest('form')
      ? `${hit.tagName}: ${hit.textContent?.trim().slice(0, 40)}`
      : 'nothing in the bar';
  }, selector);
}

test.describe('the console Refine bar', () => {
  test('applies the chosen filter when the submit is reached by keyboard', async ({
    adminPage,
  }) => {
    const filtered = await filteredBaseline(adminPage);

    await tabToSubmit(adminPage);
    await expectSubmitKeepsTheFilter(adminPage, filtered);
  });

  test('applies it with JavaScript switched off, which is what the submit is for', async ({
    scriptlessAdminPage,
  }) => {
    const filtered = await filteredBaseline(scriptlessAdminPage);

    await tabToSubmit(scriptlessAdminPage);

    /*
     * No script ran on this page — the change handler that auto-applies the
     * dropdown does not exist here, so the query survives only because the
     * form carries it as fields.
     */
    await expectSubmitKeepsTheFilter(scriptlessAdminPage, filtered);
  });

  test('does not lay its hidden submit over another control, and is hit-testable once focused', async ({
    adminPage,
  }) => {
    await adminPage.goto(FILTERED);
    await expect(adminPage).toHaveURL(FILTERED);

    /*
     * While hidden the submit is `position:absolute`, and with no offsets it
     * resolved to the flex container's content start — measured at 1440x900 on
     * all seven console Refine bars, `elementFromPoint` at its centre returned
     * the first control in the bar rather than the button.
     *
     * **`'nothing in the bar'`, not `'itself'`, and the distinction is the
     * honest one.** `sr-only`'s `clip` takes the box out of hit testing
     * altogether, so while hidden it can neither be clicked nor steal a click —
     * the ticket's "pointer-intercepted" is an overlap, not a stolen click, and
     * a control the frames do not draw cannot be made mouse-reachable without
     * drawing it. What is fixed, and what this pins, is that the box no longer
     * sits on top of a real control.
     */
    expect(
      await elementAtOwnCentre(adminPage, 'submit'),
      'the hidden submit is laid over another control in the bar',
    ).toBe('nothing in the bar');

    /*
     * Focused is the state a user can reach it in — `not-sr-only` returns it to
     * the flow — and there it must be a real pointer target, so a mouse can
     * finish what the keyboard started.
     */
    await tabToSubmit(adminPage);
    expect(
      await elementAtOwnCentre(adminPage, 'active'),
      'the focused submit is not the element at its own centre',
    ).toBe('itself');

    // Unforced: Playwright refuses a click on a point another element owns.
    await adminPage.getByRole('button', { name: 'Apply filters' }).click();
    await expect(adminPage).toHaveURL(FILTERED);
  });
});
