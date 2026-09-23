import { type Browser, type Page } from '@playwright/test';
import {
  API_VERSION_PREFIX,
  ERROR_CODES,
  TERMS_ACCEPTANCE_PATH,
  VENDOR_DETAILS_PATH,
} from '@vendor-marketplace/shared';

import { resolveE2EBaseUrl } from './base-url.js';
import { expect, expectSignedIn, storageStatePath, test as roles } from './fixtures.js';
import { waitForHydration } from './hydration.js';
import {
  assertLoopbackOrigin,
  deleteNoRowAccount,
  mintNoRowAccount,
  recordSignUpRoleFor,
  signInThroughTheForm,
} from './no-row-account.js';

/**
 * VEN-585 AC1/AC2: a vendor sign-up the invite gate refuses (VEN-406/VEN-512)
 * must settle on `/sign-up/vendor-details` and stay there — no bounce against
 * `/accept-terms` on direct nav or on the browser's own Back/Forward, and no
 * client hammering `/notifications` or `/events/stream-ticket` on a route the
 * session cannot use yet.
 *
 * Investigated 2026-09-22 against the tree as of VEN-586 (#398): the loop
 * reported while browser-verifying VEN-514 does not reproduce here — driven
 * both as repeated direct navigation and as real `goBack`/`goForward` history
 * traversal (the App Router's client Router Cache can serve a stale render on
 * a back navigation without rerunning `accept-terms/page.tsx`'s `redirect()`,
 * which is exactly the mechanism this spec exists to catch). The exempt paths
 * VEN-512 already carries (`terms-gate-paths.ts`'s `GATE_EXEMPT_PATHS`) make
 * the routing deterministic either way. This spec is the regression lock the
 * ticket's ACs ask for, not the fix for a defect that reproduced.
 *
 * The invite gate is off by default (`platform-settings.dao.ts`), so this
 * spec turns it on itself through `/admin/settings` — the same switch
 * `launch-switches.spec.ts` drives for checkout — rather than depending on a
 * lane having been seeded with `E2E_VENDOR_INVITE_ONLY=true`, and restores it
 * in `finally` regardless of the test's outcome.
 *
 * **Not idempotent against a lane this spec already ran in.** The no-row
 * persona is persistent (`no-row-account.ts`) and `GET /vendor-applications/me`
 * seeds a permanent waitlist row for it the first time this spec (or a person)
 * drives it through the refusal. A second run in that same lane database finds
 * the row already there, so `/accept-terms` server-redirects immediately and
 * the picker/refusal branch below is skipped — the spec still asserts AC2 (no
 * oscillation from the already-waitlisted state) but no longer exercises the
 * refusal response itself. A fresh lane (every real CI run, and `lane:down` +
 * `lane:up` locally) always takes the refusal branch, since `db:seed:e2e`
 * never seeds this identity's waitlist row.
 */

const SETTINGS = '/admin/settings';
/** Long enough for a post-hydration client redirect (`router.replace`) to land. */
const SETTLE_MS = 500;

async function adminContextPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath('admin') });
  const page = await context.newPage();
  await page.goto('/admin');
  await expectSignedIn(page);

  return page;
}

async function setVendorInviteOnly(adminPage: Page, on: boolean): Promise<void> {
  await adminPage.goto(SETTINGS);
  await waitForHydration(adminPage, 'button[role="switch"]');
  const toggle = adminPage.getByRole('switch', { name: 'Vendors join by invitation only' });
  const wanted = String(on);

  if ((await toggle.getAttribute('aria-checked')) !== wanted) {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute('aria-checked', wanted);
}

const test = roles.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, provide) => {
    // Before anything touches the target environment: the same guard the test
    // body makes, moved ahead of the fixture that flips a real admin switch.
    assertLoopbackOrigin(resolveE2EBaseUrl());

    const page = await adminContextPage(browser);
    await setVendorInviteOnly(page, true);

    try {
      await provide(page);
    } finally {
      // Runs even if the test body throws after the gate was flipped on, so a
      // failure here never leaves the lane's default sign-up flow gated.
      await setVendorInviteOnly(page, false);
      await page.context().close();
    }
  },
});

/** Settles past hydration and any client redirect that only fires after it. */
async function settledPath(page: Page): Promise<string> {
  await waitForHydration(page, 'h1');
  await page.waitForTimeout(SETTLE_MS);
  return new URL(page.url()).pathname;
}

test.describe('a refused vendor sign-up', () => {
  test('settles on the details screen and never loops or polls it', async ({
    adminPage,
    browser,
  }) => {
    // Only its setup/teardown matter here — it turns the invite gate on and
    // restores it, and the fixture only runs when a test destructures it.
    void adminPage;

    const account = await mintNoRowAccount();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      const requested: string[] = [];
      page.on('request', (request) => requested.push(new URL(request.url()).pathname));
      const statuses: number[] = [];
      page.on('response', (response) => statuses.push(response.status()));

      await signInThroughTheForm(page, account);

      // Continue as a vendor when the screen is showing (see the "not
      // idempotent" note above for when it is not) — the gate refuses it and
      // VEN-512's client funnel bounces straight to the details screen.
      if (new URL(page.url()).pathname === TERMS_ACCEPTANCE_PATH) {
        // The role is the one recorded at sign-up (VEN-662), stated, never picked.
        await recordSignUpRoleFor(page, 'vendor');
        await page.reload();
        await waitForHydration(page, 'form');
        await expect(page.getByTestId('stored-role')).toContainText('joining as a vendor');
        await expect(page.getByRole('radio')).toHaveCount(0);

        const [acceptResponse] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === `${API_VERSION_PREFIX}/legal/terms/accept`,
          ),
          page.getByRole('button', { name: 'Continue' }).click(),
        ]);

        // The gate must genuinely refuse this address. A success here would
        // create a real, permanent `users` row for the shared no-row persona
        // every other spec depends on staying row-less — this has to fail
        // loudly rather than let that account get silently promoted.
        expect(acceptResponse.status(), 'the invite gate did not refuse this vendor sign-up').toBe(
          403,
        );
        const body = (await acceptResponse.json()) as { error?: string };
        expect(body.error).toBe(ERROR_CODES.VENDOR_NOT_INVITED);

        await page.waitForURL((url) => url.pathname !== TERMS_ACCEPTANCE_PATH, {
          timeout: 10_000,
        });
      }

      expect(await settledPath(page)).toBe(VENDOR_DETAILS_PATH);

      // AC1: at least ten round trips between the two routes, well under a
      // minute, as both direct navigation and the browser's own Back/Forward —
      // `goBack`/`goForward` can replay a stale client-cached render instead of
      // rerunning the server redirect, which `page.goto` alone cannot exercise.
      // AC2: every one of them must resolve to exactly one route — no
      // oscillation back onto `/accept-terms`.
      const landed: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        const target = i % 2 === 0 ? TERMS_ACCEPTANCE_PATH : VENDOR_DETAILS_PATH;
        await page.goto(target);
        landed.push(await settledPath(page));
      }

      for (let i = 0; i < 4; i += 1) {
        await page.goBack();
        landed.push(await settledPath(page));
      }
      for (let i = 0; i < 4; i += 1) {
        await page.goForward();
        landed.push(await settledPath(page));
      }

      expect(landed).toEqual(Array(landed.length).fill(VENDOR_DETAILS_PATH));
      expect(statuses.filter((status) => status >= 500)).toEqual([]);
      expect(
        requested.filter((path) => /\/(notifications|events\/stream-ticket)$/.test(path)),
      ).toEqual([]);
    } finally {
      await context.close();
      await deleteNoRowAccount(account);
    }
  });
});
