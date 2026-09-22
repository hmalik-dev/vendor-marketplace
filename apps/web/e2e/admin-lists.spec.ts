import { test as base, type Page } from '@playwright/test';

import { E2E_VENDOR_SLUG } from './fixtures-data.js';
import { expect, expectSignedIn, storageStatePath } from './fixtures.js';
import { waitForHydration } from './hydration.js';

/**
 * The shared components behind the seven console lists (VEN-395).
 *
 * Every assertion here is on the rendered page — a strict locator, a bounding
 * box, a toast in the DOM, the URL a real dropdown navigated to — because each
 * defect it covers passed a source-level check: the duplicate row control was a
 * pair of CSS-gated branches, and a `className` substring said the checkbox was
 * 44px tall while nothing said how wide.
 *
 * Needs what every console spec needs (`README.md`): the lane's servers up,
 * `.auth/` regenerated in-lane, and `seed:e2e`, which gives `/admin/vendors`
 * its fixture vendor.
 */

const test = base.extend<{ adminPage: Page }>({
  // `provide` is Playwright's `use`, renamed: a bare `use(...)` trips
  // `react-hooks/rules-of-hooks`. Same reason as `fixtures.ts`.
  adminPage: async ({ browser }, provide) => {
    const context = await browser.newContext({ storageState: storageStatePath('admin') });
    const page = await context.newPage();
    await page.goto('/admin');
    await expectSignedIn(page);
    await provide(page);
    await context.close();
  },
});

/** The fixture vendor's row alone, found by slug — its name is content. */
const VENDOR_LIST = `/admin/vendors?q=${E2E_VENDOR_SLUG}`;

/** Every `···` in the DOM, hidden or not — the count a CSS-gated duplicate inflates. */
const ROW_ACTIONS = 'button[aria-label^="Actions for"]';

async function openVendorList(page: Page): Promise<void> {
  await page.goto(VENDOR_LIST);
  await expect(page).toHaveURL(VENDOR_LIST);
  await waitForHydration(page, ROW_ACTIONS);
}

test.describe('the console lists', () => {
  /*
   * Acceptance 1, at both widths: a single-width test passes while the other
   * branch's copy survives. The DOM count is the check that can fail — a
   * `display:none` copy is invisible to `getByRole`, but it is still a second
   * control under the same name for anything that walks the tree.
   */
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`/admin/vendors has one row-actions control per row at ${viewport.width}`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize(viewport);
      await openVendorList(adminPage);

      await expect(adminPage.locator(ROW_ACTIONS)).toHaveCount(1);
      await adminPage.getByRole('button', { name: /Actions for/ }).click();
      await expect(adminPage.getByRole('menuitem').first()).toBeVisible();
    });
  }

  test('the search field has a visible label and the row checkbox is a 44px target', async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await openVendorList(adminPage);

    const search = adminPage.getByRole('searchbox', { name: 'Search' });
    await expect(search).toBeVisible();
    await expect(adminPage.locator('label', { hasText: /^Search$/ })).toBeVisible();

    const target = adminPage.locator('label', { has: adminPage.getByRole('checkbox') }).first();
    const box = await target.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    // The target takes the pointer at its left edge, which the 22px label did not reach.
    await adminPage.mouse.click((box?.x ?? 0) + 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await expect(adminPage.getByRole('checkbox').first()).toBeChecked();
  });

  /*
   * Acceptance 2. Unpublish, then publish, so the fixture vendor ends where it
   * started — both directions are the ones under test, and a run that stopped
   * after the first leaves a state `seed:e2e` does not undo.
   */
  test('publishing and unpublishing a storefront each confirm with a toast', async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 1440, height: 900 });
    await openVendorList(adminPage);

    for (const [action, confirmation] of [
      ['Unpublish profile', /'s profile is hidden\.$/],
      ['Publish profile', /'s profile is live\.$/],
    ] as const) {
      await adminPage.getByRole('button', { name: /Actions for/ }).click();
      await adminPage.getByRole('menuitem', { name: action }).click();
      await adminPage.getByRole('alertdialog').getByRole('button', { name: action }).click();

      await expect(
        adminPage.locator('[data-sonner-toast]').filter({ hasText: confirmation }),
      ).toBeVisible();
      await waitForHydration(adminPage, ROW_ACTIONS);
    }
  });

  /*
   * Acceptance 3: one spec per list, driven through the bar. Each starts with
   * every *other* filter the list has already applied, chooses the first real
   * option in one dropdown, and reads the URL the dropdown navigated to. `page`
   * starts at 2 so dropping it is observed rather than assumed.
   */
  const LISTS = [
    {
      path: '/admin/vendors',
      others: { q: 'zz', status: 'review' },
      dropdown: 'City',
      param: 'city',
    },
    {
      path: '/admin/customers',
      others: { q: 'zz', flag: 'email-stale' },
      dropdown: 'Status',
      param: 'status',
    },
    {
      path: '/admin/bookings',
      others: { flag: 'refund-stuck' },
      dropdown: 'Status',
      param: 'status',
    },
    { path: '/admin/cases', others: { status: 'resolved' }, dropdown: 'Booking', param: 'booking' },
    {
      path: '/admin/activity',
      others: {
        actor: '0f3f3d4a-1c0a-4a1e-8f6a-2b1c9d4e5f60',
        subject: 'b4f0a1c2-3d4e-4f50-9a6b-7c8d9e0f1a2b',
      },
      dropdown: 'Action',
      param: 'action',
    },
    { path: '/admin/payments', others: {}, dropdown: 'Needs attention', param: 'flag' },
    { path: '/admin/reviews', others: {}, dropdown: 'Direction', param: 'type' },
  ] as const;

  for (const list of LISTS) {
    test(`${list.path}: changing ${list.dropdown} keeps every other filter`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width: 1440, height: 900 });
      const start = new URLSearchParams({ ...list.others, page: '2' });
      await adminPage.goto(`${list.path}?${start.toString()}`);

      const trigger = adminPage.getByRole('button', { name: list.dropdown, exact: true });
      await waitForHydration(adminPage, 'form button[aria-haspopup="listbox"]');
      await trigger.click();
      await adminPage.getByRole('option').filter({ hasNotText: /^Any / }).first().click();

      await expect(adminPage).not.toHaveURL(/page=2/);
      const landed = new URL(adminPage.url()).searchParams;

      expect(landed.get('page')).toBeNull();
      for (const [key, value] of Object.entries(list.others)) {
        expect(landed.get(key), `${list.path} dropped ${key}`).toBe(value);
      }
      expect([...landed.keys()].sort()).toEqual([...Object.keys(list.others), list.param].sort());
    });
  }
});
