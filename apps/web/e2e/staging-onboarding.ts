import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readStagingMailCode } from './staging-mail-code.js';

/**
 * Minimal page objects for the one flow `staging-messages-rls.staging.spec.ts`
 * needs: a fresh sign-up through to a published vendor storefront with one
 * package, and back down to a fresh customer. Nothing here generalises beyond
 * that flow — there is no other spec in this repo that signs up a real
 * account, and a framework for a flow used once is scope this ticket does not
 * carry.
 */

export interface FreshAccount {
  email: string;
  password: string;
}

/** A run-scoped Mailosaur local part: no `+`, which Mailosaur does not route. */
export function stagingAddress(server: string, runId: string, who: 'cust' | 'vendor'): string {
  return `orla-stg-${runId}-${who}@${server}.mailosaur.net`;
}

/**
 * Signs up `account` as `role`, reads the verification code off the real
 * Mailosaur inbox, and lands the session past the six-digit-code step. The
 * caller still has to clear `/accept-terms` — sign-up never skips it.
 */
export async function signUpAndVerify(
  page: Page,
  account: FreshAccount,
  role: 'customer' | 'vendor',
): Promise<void> {
  await page.goto(`/sign-up?role=${role}`);

  await page
    .getByRole('radio', { name: role === 'vendor' ? "I'm a vendor" : "I'm planning an event" })
    .check();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Create my account' }).click();

  await expect(
    page.getByLabel('Verification code'),
    `no verification-code field after signing up ${account.email} — sign-up may have failed`,
  ).toBeVisible({ timeout: 30_000 });

  const code = await readStagingMailCode(account.email);

  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify email' }).click();
}

/**
 * The acceptance every account clears exactly once, whatever role it is.
 *
 * A fresh sign-up hits the no-tick path — the role was recorded on the server
 * at sign-up (VEN-662) and is stated, so `Continue` is enabled with nothing else to do
 * (`accept-terms-screen.tsx`'s `tickMode` is only for a *returning* account
 * facing a new Terms version, which never applies to an account this spec
 * just created).
 */
export async function acceptTerms(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/accept-terms/, { timeout: 30_000 });
  await page.getByRole('button', { name: /^(Accept and continue|Continue)$/ }).click();
}

export interface StorefrontDetails {
  businessName: string;
  city: string;
  state: string;
  bio: string;
}

/**
 * Fills the vendor profile far enough to clear every publish blocker but
 * `packages` and `agreement`, which the caller clears separately — the same
 * order `onboarding-steps.tsx` fixes (profile, then agreement, then publish).
 */
export async function fillVendorProfile(page: Page, details: StorefrontDetails): Promise<void> {
  await page.goto('/vendor/profile/edit');

  await page.getByLabel('Business name').fill(details.businessName);
  await page.getByLabel('City').fill(details.city);

  /*
   * Both dropdown triggers are `<label for>`-associated buttons, so their
   * accessible name is the label text ("State", "Typical response time"),
   * not the placeholder text they render when nothing is chosen yet.
   */
  await page.getByRole('button', { name: 'State' }).click();
  await page.getByRole('option', { name: details.state, exact: true }).click();

  await page.getByRole('group', { name: 'Categories' }).getByRole('button').first().click();

  await page.getByLabel('About your business').fill(details.bio);

  // The first option is "Not specified", which is itself a publish blocker.
  await page.getByRole('button', { name: 'Typical response time' }).click();
  await page.getByRole('option', { name: 'Within 24 hours' }).click();

  await page.getByRole('button', { name: /^(Create profile|Save changes)$/ }).click();
  await expect(page.getByText(/^Saved/)).toBeVisible({ timeout: 20_000 });
}

/** Step 3 of onboarding — the vendor agreement, which precedes Stripe Connect. */
export async function acceptVendorAgreement(page: Page): Promise<void> {
  await page.goto('/vendor/agreement');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  // Matched against the record's heading, not the bare word "Accepted" — the
  // record's own table also carries a header cell of exactly that text.
  await expect(page.getByText(/^Vendor agreement .* — accepted$/)).toBeVisible({
    timeout: 20_000,
  });
}

export interface PackageDetails {
  name: string;
  description: string;
  priceDollars: string;
}

/** One bookable package — the last publish blocker besides the agreement. */
export async function addPackage(page: Page, details: PackageDetails): Promise<void> {
  await page.goto('/vendor/packages');
  await page.getByRole('button', { name: 'Add a package' }).click();

  await page.getByLabel('Package name').fill(details.name);
  await page.getByLabel('What it includes, in a sentence or two').fill(details.description);
  // Not exact, "Price" also substring-matches the "How it is priced" select trigger.
  await page.getByLabel('Price', { exact: true }).fill(details.priceDollars);

  await page.getByRole('button', { name: 'Add package' }).click();
  await expect(page.getByText(details.name)).toBeVisible({ timeout: 20_000 });
}

/** Flips the storefront live once every blocker but this switch is clear. */
export async function publishStorefront(page: Page): Promise<void> {
  await page.goto('/vendor/profile/edit');
  const toggle = page.getByRole('switch', { name: 'Visible to customers' });
  await expect(
    toggle,
    'the publish switch is still disabled — a blocker was not cleared',
  ).toBeEnabled({
    timeout: 20_000,
  });
  await toggle.check();
  await expect(toggle).toBeChecked();
}

/**
 * Takes the storefront back down. Staging is where the beta's real customers
 * search and browse, so a probe vendor left published would be a fake result
 * a real person could find and message — the run's throwaway accounts are
 * accepted to stay, per the ticket's own Decisions, but a listed storefront
 * is not the same thing, and this spec must undo it itself.
 */
export async function unpublishStorefront(page: Page): Promise<void> {
  await page.goto('/vendor/profile/edit');
  const toggle = page.getByRole('switch', { name: 'Visible to customers' });
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
}
