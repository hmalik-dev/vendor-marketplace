import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { generateSlug } from '@vendor-marketplace/shared';
import { AUTH_DIR } from './fixtures.js';
import {
  acceptTerms,
  acceptVendorAgreement,
  addPackage,
  fillVendorProfile,
  publishStorefront,
  signUpAndVerify,
  stagingAddress,
  unpublishStorefront,
  type FreshAccount,
} from './staging-onboarding.js';
import { assertStagingEnvironment } from './staging-guard.js';

/**
 * Proves `/messages` under the `app_api` row-level-security role, on staging,
 * with real accounts (VEN-562). This replaces the manual "sign in and open
 * /messages" step of VEN-505 criterion 6 and `docs/app-api-role.md` step 6.
 *
 * **Never runs in the lane or CI suites** — `assertStagingEnvironment` refuses
 * anywhere but a local shell pointed at a host that names staging, and this
 * config is not the one `test:e2e` or CI's end-to-end job load. Run it with:
 *
 *   STAGING_WEB_URL=https://<staging-web-host> \
 *   DEPLOY_ENV=local \
 *   pnpm --filter @vendor-marketplace/web test:e2e:staging
 *
 * On any failure: every assertion message below names the page's own URL and
 * carries the rollback line, and `trackResponses` records every non-2xx
 * response each page received (attached to the test report) — together, the
 * page, its status and the rollback are what the failed run shows. If the
 * failure looks like a permission refusal rather than a product bug, the
 * rollback is to set Railway `staging`'s `DATABASE_URL` back to the account
 * holder's pooled owner string and redeploy — this spec never touches Railway
 * itself (`docs/app-api-role.md`).
 */

assertStagingEnvironment();

const ROLLBACK =
  "if this is a permission refusal rather than a product bug, roll back: set Railway staging's " +
  'DATABASE_URL back to the pooled owner string and redeploy.';

/** `page`, a status-bearing message, and the rollback line, for one assertion. */
function failureContext(page: Page, detail: string): string {
  return `${detail} (page: ${page.url()}). ${ROLLBACK}`;
}

/** Every non-2xx response a page receives, attached to the report on failure. */
function trackResponses(page: Page, label: string): void {
  page.on('response', (response) => {
    if (!response.ok()) {
      test.info().annotations.push({
        type: 'staging-api-failure',
        description: `${label}: ${response.status()} ${response.request().method()} ${response.url()}`,
      });
    }
  });
}

/**
 * `E2E_MAIL_SERVER` only — never `E2E_MAIL_API_KEY`, which stays inside the
 * `e2e:mail-code` subprocess. This config doesn't load `.env.e2e.local` the
 * way the lane's default config does, and sourcing the whole file into this
 * shell to work around that would put the mailbox key in this process's
 * environment and every child process's too, undoing the separation
 * `staging-mail-code.ts` exists for. Modelled on `no-row-account.ts`'s single
 * -key file read.
 */
function readMailServer(): string {
  const fromEnv = process.env.E2E_MAIL_SERVER?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const file = resolve(dirname(AUTH_DIR), '.env.e2e.local');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const fromFile = text
    .match(/^E2E_MAIL_SERVER=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');

  if (!fromFile) {
    throw new Error(
      'E2E_MAIL_SERVER is not set and is not in .env.e2e.local — needed to build the Mailosaur addresses.',
    );
  }

  return fromFile;
}

const SERVER = readMailServer();

/**
 * Generated once per run rather than a literal: these are real passwords on a
 * live deployment, and nothing needs to reuse this one across runs — the
 * accounts it opens are read by nobody but this run's own pages.
 */
function freshPassword(): string {
  return `Orla-${randomBytes(12).toString('hex')}-Aa1!`;
}

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Pair {
  customer: FreshAccount;
  vendor: FreshAccount;
  businessName: string;
}

function pair(label: string): Pair {
  const suffix = `${RUN_ID}-${label}`;
  return {
    customer: { email: stagingAddress(SERVER, suffix, 'cust'), password: freshPassword() },
    vendor: { email: stagingAddress(SERVER, suffix, 'vendor'), password: freshPassword() },
    businessName: `Orla Staging RLS ${suffix}`,
  };
}

const PAIR_A = pair('a');
const PAIR_B = pair('b');

/** Onboards a fresh vendor to a published storefront with one package. */
async function onboardVendor(page: Page, p: Pair): Promise<void> {
  await signUpAndVerify(page, p.vendor, 'vendor');
  await acceptTerms(page);
  await fillVendorProfile(page, {
    businessName: p.businessName,
    city: 'Austin',
    state: 'Texas',
    bio: `Staging RLS probe vendor for run ${RUN_ID}.`,
  });
  await acceptVendorAgreement(page);
  await addPackage(page, {
    name: 'RLS probe package',
    description: 'A package that exists only to clear the publish checklist.',
    priceDollars: '250',
  });
  await publishStorefront(page);
}

/** Onboards a fresh customer past `/accept-terms` and back to the marketplace. */
async function onboardCustomer(page: Page, p: Pair): Promise<void> {
  await signUpAndVerify(page, p.customer, 'customer');
  await acceptTerms(page);
}

/** The customer opens the vendor's storefront and sends the opening message. */
async function sendOpeningMessage(page: Page, p: Pair, text: string): Promise<void> {
  await page.goto(`/vendors/${generateSlug(p.businessName)}`);
  await page.getByRole('button', { name: 'Send a message' }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=/);

  const composer = page.getByLabel('Write a message');
  await composer.fill(text);
  await page.getByRole('button', { name: /^send$/i }).click();

  await expect(
    page.getByRole('paragraph').filter({ hasText: text }),
    failureContext(
      page,
      `${p.customer.email}'s message never rendered in their own thread — send may have failed`,
    ),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe('staging /messages under app_api', () => {
  test('two customer/vendor pairs onboard, message, and stay isolated', async ({ browser }) => {
    const customerAContext = await browser.newContext();
    const vendorAContext = await browser.newContext();
    const customerBContext = await browser.newContext();
    const vendorBContext = await browser.newContext();

    // Declared outside `try` so `finally` below — which unpublishes both
    // storefronts however the test went — can still reach the vendor pages;
    // a `const` inside `try` is scoped to that block alone.
    const vendorA = await vendorAContext.newPage();
    const vendorB = await vendorBContext.newPage();

    try {
      const customerA = await customerAContext.newPage();
      const customerB = await customerBContext.newPage();

      trackResponses(customerA, 'customer A');
      trackResponses(vendorA, 'vendor A');
      trackResponses(customerB, 'customer B');
      trackResponses(vendorB, 'vendor B');

      // Both vendors first: the storefronts have to exist before either
      // customer can open one to message it.
      await onboardVendor(vendorA, PAIR_A);
      await onboardVendor(vendorB, PAIR_B);

      await onboardCustomer(customerA, PAIR_A);
      await onboardCustomer(customerB, PAIR_B);

      const messageA = `RLS probe A ${Date.now()}`;
      const messageB = `RLS probe B ${Date.now()}`;

      // AC1 — the customer's list shows the conversation named for the
      // vendor, and opening it shows the customer's own message.
      await sendOpeningMessage(customerA, PAIR_A, messageA);
      await sendOpeningMessage(customerB, PAIR_B, messageB);

      await expect(
        customerA.locator('aside ul > li').filter({ hasText: PAIR_A.businessName }),
        failureContext(customerA, "customer A's inbox row does not name the vendor"),
      ).toHaveCount(1);

      // AC2 — the vendor sees the same conversation and a reply lands on the
      // customer's open thread. Scoped to the "Message history" region: a
      // delivered message also fires an `aria-live` announcement paragraph
      // elsewhere on the page, which a bare role query would also match.
      await vendorA.goto('/messages');
      const vendorAHistory = vendorA.getByRole('region', { name: 'Message history' });
      await expect(
        vendorAHistory.getByRole('paragraph').filter({ hasText: messageA }),
        failureContext(
          vendorA,
          'vendor A cannot see the customer A message — delivery is broken, or RLS is scoping it out',
        ),
      ).toBeVisible({ timeout: 20_000 });

      const reply = `RLS probe reply ${Date.now()}`;
      await vendorA.getByLabel('Write a message').fill(reply);
      await vendorA.getByRole('button', { name: /^send$/i }).click();

      const customerAHistory = customerA.getByRole('region', { name: 'Message history' });
      await expect(
        customerAHistory.getByRole('paragraph').filter({ hasText: reply }),
        failureContext(customerA, "vendor A's reply never reached customer A's open thread"),
      ).toBeVisible({ timeout: 20_000 });

      // AC3 — isolation. Customer A's list holds exactly one conversation …
      const conversationRows = customerA.locator('aside ul > li');
      await expect(
        conversationRows,
        failureContext(customerA, "customer A's inbox does not hold exactly one conversation"),
      ).toHaveCount(1);
      await expect(
        customerAHistory.getByRole('paragraph').filter({ hasText: messageB }),
        failureContext(
          customerA,
          "customer A's thread rendered pair B's message — RLS is not isolating threads",
        ),
      ).toHaveCount(0);

      // … and a direct navigation to pair B's thread does not render it. The
      // client only ever requests a conversation already in its own list
      // (`messages-screen.tsx`), so this re-proves the list's own scoping
      // rather than the messages endpoint directly — the observed state is
      // the screen's not-found empty state, asserted by its own heading.
      const conversationBUrl = new URL(customerB.url());
      const conversationBId = conversationBUrl.searchParams.get('conversation');
      if (!conversationBId) {
        throw new Error("could not read pair B's conversation id off customer B's own URL");
      }

      await customerA.goto(`/messages?conversation=${conversationBId}`);
      await expect(
        customerA.getByRole('heading', { name: 'We could not find that conversation' }),
        failureContext(
          customerA,
          `customer A did not see the not-found state for pair B's thread (${conversationBId}) — a real RLS leak`,
        ),
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      /*
       * Staging is where the beta's real customers search and browse, so a
       * probe vendor left published is a fake result a real person could
       * find. `Promise.allSettled`, not `Promise.all`: this must run
       * regardless of how far the test above got (a vendor that never
       * cleared its publish blockers has nothing to unpublish), and a
       * cleanup failure must not throw here and replace the real assertion
       * failure this `finally` is unwinding from — it's recorded as an
       * annotation instead, so it still shows up in the report.
       */
      const cleanup = await Promise.allSettled([
        unpublishStorefront(vendorA),
        unpublishStorefront(vendorB),
      ]);
      for (const result of cleanup) {
        if (result.status === 'rejected') {
          test.info().annotations.push({
            type: 'staging-cleanup-failure',
            description: `could not unpublish a probe storefront: ${String(result.reason)}`,
          });
        }
      }

      await Promise.all([
        customerAContext.close(),
        vendorAContext.close(),
        customerBContext.close(),
        vendorBContext.close(),
      ]);
    }
  });

  // AC4 — signed-out never leaks anything.
  test('sends a signed-out visitor from /messages to sign-in', async ({ page }) => {
    await page.goto('/messages');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
