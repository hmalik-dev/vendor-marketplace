import { type Page } from '@playwright/test';

import { expect, test } from './fixtures.js';
import { E2E_VENDOR_SLUG } from './fixtures-data.js';
import { waitForHydration } from './hydration.js';

/* VEN-779 DIAGNOSTIC — removed before merge. Does router.refresh() commit on each route? */

const ROUNDS = 25;

async function refreshOnce(page: Page): Promise<string> {
  const events: string[] = [];
  const onNav = (frame: { url(): string }): void => {
    if (frame === page.mainFrame()) events.push('commit');
  };
  const onFailed = (request: { headers(): Record<string, string> }): void => {
    if (request.headers()['rsc'] === '1' && !request.headers()['next-router-prefetch']) {
      events.push('aborted');
    }
  };
  const onFinished = (request: { headers(): Record<string, string> }): void => {
    if (request.headers()['rsc'] === '1' && !request.headers()['next-router-prefetch']) {
      events.push('finished');
    }
  };
  page.on('framenavigated', onNav);
  page.on('requestfailed', onFailed);
  page.on('requestfinished', onFinished);
  const had = await page.evaluate(() => {
    const router = (window as unknown as { next?: { router?: { refresh(): void } } }).next?.router;
    if (!router) return false;
    router.refresh();
    return true;
  });
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && !events.includes('commit')) {
    await page.waitForTimeout(100);
  }
  page.off('framenavigated', onNav);
  page.off('requestfailed', onFailed);
  page.off('requestfinished', onFinished);
  return had ? events.join('+') || 'nothing' : 'no-router';
}

for (const path of [
  `/vendors/${E2E_VENDOR_SLUG}?tab=reviews`,
  `/vendors/${E2E_VENDOR_SLUG}`,
  '/bookings',
  '/messages',
  '/customer/profile',
]) {
  test(`router.refresh() commits on ${path}`, async ({ customerPage }) => {
    test.setTimeout(ROUNDS * 7_000 + 30_000);
    await customerPage.goto(path);
    await waitForHydration(customerPage, 'main');
    const outcomes: string[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      outcomes.push(await refreshOnce(customerPage));
    }
    const tally = outcomes.reduce<Record<string, number>>((acc, outcome) => {
      acc[outcome] = (acc[outcome] ?? 0) + 1;
      return acc;
    }, {});
    await test.info().attach('outcomes', {
      body: `${path}\n${JSON.stringify(tally)}\n${outcomes.join('\n')}`,
      contentType: 'text/plain',
    });
    // Always fails, so the report (and this tally) is uploaded.
    expect(`${path} ${JSON.stringify(tally)}`).toBe('report');
  });
}
