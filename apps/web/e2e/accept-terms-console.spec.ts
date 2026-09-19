import { resolveE2EBaseUrl } from './base-url.js';
import { expect, test } from './fixtures.js';
import { waitForHydration } from './hydration.js';
import {
  assertLoopbackOrigin,
  deleteNoRowAccount,
  mintNoRowAccount,
  signInThroughTheForm,
} from './no-row-account.js';

/*
 * VEN-451 AC 2: `/accept-terms` for a fresh account logs no console errors.
 *
 * What this pins is the acceptance screen's own health for the persistent
 * newcomer (no `users` row, so its header is the signed-out one). It does
 * **not** fail if the bell's `usePathname` guard is removed: that case needs an
 * account that has a row but has not accepted the current Terms, which no
 * persona provides. The guard itself is asserted in
 * `notification-bell.test.tsx`, which does fail without it.
 */
test.describe('the acceptance interstitial', () => {
  test('logs no console errors and makes no bell requests for a fresh account', async ({
    browser,
  }) => {
    assertLoopbackOrigin(resolveE2EBaseUrl());
    const account = await mintNoRowAccount();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      const requested: string[] = [];
      page.on('request', (request) => requested.push(new URL(request.url()).pathname));

      const landing = await signInThroughTheForm(page, account);
      expect(landing.pathname).toBe('/accept-terms');
      await waitForHydration(page, 'header button');

      expect(
        requested.filter((path) => /\/(notifications|events\/stream-ticket)$/.test(path)),
      ).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await deleteNoRowAccount(account);
    }
  });
});
