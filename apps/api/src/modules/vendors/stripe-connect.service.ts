import {
  VENDOR_PAYMENTS_RESUME_PATH,
  VENDOR_PAYMENTS_RETURN_PATH,
  type VendorPayoutStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import { z } from 'zod';
import { isOnboarded, type StripeConnectGateway } from '../../lib/stripe.js';
import { findUserById } from '../users/users.dao.js';
import {
  claimStripeAccountId,
  findVendorProfileByStripeAccountId,
  findVendorProfileByUserId,
  updateVendorProfileById,
} from './vendors.dao.js';

/** What every Stripe Connect operation needs. */
export interface StripeConnectDeps {
  db: AppDatabase;
  stripe: StripeConnectGateway;
}

/**
 * Onboarding additionally has to tell Stripe where to send the vendor back to.
 * Kept off `StripeConnectDeps` so the webhook — which has nowhere to send
 * anyone — is not made to carry a value it never reads.
 */
export interface StripeOnboardingDeps extends StripeConnectDeps {
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
  deps: StripeOnboardingDeps,
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

    /*
     * Persisted before the link is minted, and claimed conditionally. Two tabs
     * pressing the button at once both reach here, and only one write can land:
     * whichever loses discards the account it just created and mints its link
     * against the winner's, so the row and the account the vendor onboards are
     * always the same one. Doing it the other way round — link first, write
     * second — is what strands an account nobody can look up again.
     */
    const claimed = await claimStripeAccountId(deps.db, vendor.id, created.accountId);

    /*
     * `null` means the row is gone — soft-deleted during the Stripe round trip.
     * Falling back to the account just created would mint a link against an
     * account no row names, which is exactly the stranding the claim exists to
     * prevent, so this refuses instead.
     */
    if (!claimed?.stripeAccountId) {
      throw notFound('You have not created a vendor profile yet');
    }

    accountId = claimed.stripeAccountId;
  }

  return deps.stripe.createOnboardingLink({
    accountId,
    returnUrl: `${deps.returnOrigin}${VENDOR_PAYMENTS_RETURN_PATH}`,
    refreshUrl: `${deps.returnOrigin}${VENDOR_PAYMENTS_RESUME_PATH}`,
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

/**
 * The four things a notification can do to a vendor's payout flag. Declared as
 * a schema because the webhook serialises it straight into its response, and
 * two hand-written copies of one vocabulary is how a response body and the
 * handler behind it drift apart.
 */
export const accountUpdateOutcomeSchema = z.enum([
  'onboarded',
  'not-onboarded',
  'unchanged',
  'ignored',
]);

/** What `applyAccountStatusChange` did, for the webhook's response and its log line. */
export type AccountUpdateOutcome = z.infer<typeof accountUpdateOutcomeSchema>;

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

  const status = await deps.stripe.readAccountStatus(accountId);
  const onboarded = isOnboarded(status);

  if (onboarded === vendor.stripeOnboarded) {
    return 'unchanged';
  }

  await updateVendorProfileById(deps.db, vendor.id, { stripeOnboarded: onboarded });

  return onboarded ? 'onboarded' : 'not-onboarded';
}
