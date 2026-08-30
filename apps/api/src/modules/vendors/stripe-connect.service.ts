import type { VendorPayoutStatus } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import {
  isOnboarded,
  type StripeConnectGateway,
  type StripeAccountStatus,
} from '../../lib/stripe.js';
import { findUserById } from '../users/users.dao.js';
import {
  findVendorProfileByStripeAccountId,
  findVendorProfileByUserId,
  updateVendorProfileById,
} from './vendors.dao.js';

/**
 * Where Stripe drops the vendor once the hosted form is finished or abandoned.
 * `payments` rather than `payouts` because that is the word frame `08` puts in
 * the vendor's sidebar, and the route a nav item points at should read like the
 * nav item.
 */
export const PAYOUT_RETURN_PATH = '/vendor/payments/return';

/**
 * Where Stripe drops them when the link has expired or was already used. It is
 * the payouts page itself rather than a dedicated route: the page already knows
 * how to mint a new link, and `resume` is what turns its heading into an
 * explanation of why they are back.
 */
export const PAYOUT_REFRESH_PATH = '/vendor/payments?resume=1';

export interface StripeConnectDeps {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  /** Origin Stripe returns the vendor to, with no trailing slash. */
  returnOrigin: string;
}

/**
 * Starts — or resumes — hosted onboarding, and answers with the URL to send the
 * vendor to.
 *
 * Creating the account and minting the link are deliberately separate: the
 * account is created at most once and persisted immediately, while a link is
 * minted on every call because Stripe expires them after five minutes and
 * refuses a second visit. That is also what makes the flow idempotent under the
 * repeated clicking a slow redirect invites — three clicks produce three links
 * against one account, never three accounts.
 */
export async function startPayoutOnboarding(
  deps: StripeConnectDeps,
  userId: string,
): Promise<{ url: string }> {
  const vendor = await findVendorProfileByUserId(deps.db, userId);
  if (!vendor) {
    throw notFound('You have not created a vendor profile yet');
  }

  let accountId = vendor.stripeAccountId;

  if (!accountId) {
    const user = await findUserById(deps.db, userId);
    if (!user) {
      throw notFound('You have not created a vendor profile yet');
    }

    const created = await deps.stripe.createRecipientAccount({
      vendorId: vendor.id,
      contactEmail: user.email,
      displayName: vendor.businessName,
    });
    accountId = created.accountId;

    /*
     * Persisted before the link is minted. If link creation fails, the vendor
     * retries against the account that already exists; if the write were the
     * later of the two, the retry would strand the first account and open a
     * second, which is the duplicate-account failure this ordering prevents.
     */
    await updateVendorProfileById(deps.db, vendor.id, { stripeAccountId: accountId });
  }

  return deps.stripe.createOnboardingLink({
    accountId,
    returnUrl: `${deps.returnOrigin}${PAYOUT_RETURN_PATH}`,
    refreshUrl: `${deps.returnOrigin}${PAYOUT_REFRESH_PATH}`,
  });
}

/**
 * The vendor's payout state as this database understands it. Deliberately no
 * Stripe call: the dashboard banner and the return page both read this, and a
 * network round trip on every dashboard render would make the slowest surface
 * in the product depend on a third party's latency. Stripe pushes changes in
 * through the webhook instead.
 */
export async function readPayoutStatus(
  db: AppDatabase,
  userId: string,
): Promise<VendorPayoutStatus> {
  const vendor = await findVendorProfileByUserId(db, userId);
  if (!vendor) {
    throw notFound('You have not created a vendor profile yet');
  }

  return {
    stripeAccountId: vendor.stripeAccountId,
    stripeOnboarded: vendor.stripeOnboarded,
  };
}

/** What `applyAccountStatusChange` did, for the webhook's response and its log line. */
export type AccountUpdateOutcome = 'onboarded' | 'not-onboarded' | 'unchanged' | 'ignored';

/**
 * Re-reads the account from Stripe and writes the derived flag. The event
 * itself is not trusted for the value — a thin notification says only that
 * something changed, and re-reading is what makes the handler correct under
 * out-of-order delivery and what lets a *revoked* capability flip the flag back
 * to false through exactly the same path that set it.
 */
export async function applyAccountStatusChange(
  deps: StripeConnectDeps,
  accountId: string,
): Promise<AccountUpdateOutcome> {
  const vendor = await findVendorProfileByStripeAccountId(deps.db, accountId);
  if (!vendor) {
    return 'ignored';
  }

  const status: StripeAccountStatus = await deps.stripe.readAccountStatus(accountId);
  const onboarded = isOnboarded(status);

  if (onboarded === vendor.stripeOnboarded) {
    return 'unchanged';
  }

  await updateVendorProfileById(deps.db, vendor.id, { stripeOnboarded: onboarded });

  return onboarded ? 'onboarded' : 'not-onboarded';
}
