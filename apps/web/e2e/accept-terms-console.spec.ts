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
 * VEN-451. The Terms-gated header used to ask `/notifications` and
 * `/events/stream-ticket` for an account the gate refuses, and the browser
 * logged both 403s as console errors on a screen that is otherwise correct.
 */
test.describe('the acceptance interstitial', () => {
  test('logs no console errors for a fresh account', async ({ browser }) => {
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

      /*
       * The bell's calls are issued from an effect, so they start the moment
       * the header hydrates; the request log is the deterministic half (a
       * request is recorded when sent), the console the symptom.
       */
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
