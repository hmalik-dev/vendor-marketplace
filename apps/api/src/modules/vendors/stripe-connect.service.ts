import type { NewVendorProfileRow } from '@vendor-marketplace/db/schema';
import {
  VENDOR_PAYMENTS_RESUME_PATH,
  VENDOR_PAYMENTS_RETURN_PATH,
  type VendorPayoutStatus,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import type { AppDatabase } from '../../lib/database.js';
import { conflict, notFound } from '../../lib/errors.js';
import {
  isMissingPayoutsOnly,
  isOnboarded,
  RecipientAccountRefusedError,
  type StripeAccountStatus,
  type StripeConnectGateway,
} from '../../lib/stripe.js';
import { notifyVendorUser, PAYOUT_NOTICES, type NotifyDeps } from '../notifications/notify-user.js';
import { findUserById } from '../users/users.dao.js';
import { holdsCurrentAgreement } from './legal-agreement.service.js';
import {
  claimStripeAccountId,
  findVendorProfileByStripeAccountId,
  findVendorProfileByUserId,
  recordAccountRefusal,
  updateVendorStripeStatusIfUnchanged,
} from './vendors.dao.js';

/** What every Stripe Connect operation needs. */
export interface StripeConnectDeps {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  /** The request logger, so a half-onboarded account is diagnosable. */
  log?: { warn: (details: Record<string, unknown>, message: string) => void };
  /** Where the vendor is told the account changed. The webhook passes it (VEN-525). */
  notify?: NotifyDeps;
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

  /*
   * **Step 3 before step 4, enforced rather than drawn.**
   *
   * The vendor agreement precedes Stripe Connect because the commission and
   * the payout timing are agreed before a payout rail exists to implement them
   * — #427, frame `32`. Until this refused it, that ordering was a rail on a
   * screen and nothing else: a vendor could complete Connect first and end up
   * exactly where the ordering exists to prevent, holding a verified account
   * attached to a listing nobody can pay, having handed over bank details
   * without being told what the platform keeps.
   *
   * A 409 rather than a 403: nothing is wrong with the caller, there is a step
   * outstanding, and the message names it.
   */
  if (!(await holdsCurrentAgreement(deps.db, vendor.userId))) {
    throw conflict('Accept the vendor agreement before connecting payouts');
  }

  let accountId = vendor.stripeAccountId;

  if (!accountId) {
    const user = await findUserById(deps.db, userId);
    if (!user) {
      throw notFound('You have not created a vendor profile yet');
    }

    const attempts = vendor.stripeAccountAttempts;
    let created: { accountId: string };

    try {
      /*
       * Keyed on the vendor, so two presses inside one round trip get the same
       * account back instead of one live and one orphan (VEN-526). The key is
       * versioned by the refusals recorded so far, not fixed (D36): Stripe
       * replays a *refused* result for 24 hours, and a fixed key would answer
       * every retry with the first refusal.
       */
      created = await deps.stripe.createRecipientAccount({
        vendorId: vendor.id,
        contactEmail: user.email,
        displayName: vendor.businessName,
        idempotencyKey: `recipient-account:${vendor.id}:${attempts}`,
      });
    } catch (error) {
      // Only a refusal Stripe answered moves the key; a dropped connection may
      // have made the account, and a new key would make a second.
      if (error instanceof RecipientAccountRefusedError) {
        await recordAccountRefusal(deps.db, vendor.id, attempts).catch((recordError: unknown) =>
          deps.log?.warn(
            { err: recordError, vendorId: vendor.id },
            'Could not record a refused account creation; the retry will reuse its key',
          ),
        );
      }

      throw error;
    }

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

/** The hosts a Stripe Express login link is served from. */
const DASHBOARD_LINK_HOSTS: ReadonlySet<string> = new Set([
  'connect.stripe.com',
  'express.stripe.com',
]);

/**
 * A single-use link into the vendor's own Stripe Express dashboard (VEN-725).
 * The account is read from the caller's profile, never from the request. The
 * URL is checked to be on a Stripe host before it is handed to a browser that
 * will navigate to it.
 */
export async function createDashboardLink(
  deps: StripeConnectDeps,
  userId: string,
): Promise<{ url: string }> {
  const vendor = await findVendorProfileByUserId(deps.db, userId);

  if (!vendor?.stripeAccountId) {
    throw notFound('Payouts are not connected yet');
  }

  const link = await deps.stripe.createDashboardLink(vendor.stripeAccountId);
  const { protocol, hostname } = new URL(link.url);

  if (protocol !== 'https:' || !DASHBOARD_LINK_HOSTS.has(hostname)) {
    throw new Error('Stripe returned a dashboard link on an unexpected host');
  }

  return link;
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
 * How many times one delivery re-reads after finding the row moved under it.
 * Each miss means another handler wrote, so one retry nearly always settles it.
 */
const MAX_STATUS_ATTEMPTS = 3;

/**
 * Re-reads the account from Stripe and writes the derived flag. The event
 * itself is not trusted for the value — a thin notification says only that
 * something changed, and re-reading is what makes the handler correct under
 * out-of-order delivery and what lets a *revoked* capability flip the flag back
 * to false through exactly the same path that set it.
 *
 * Re-reading covers events arriving out of order, not handlers running at once:
 * `account.updated` and each `capability.updated` are separate deliveries, and
 * one whose Stripe read was older can write last. So the write is conditional on
 * the row still being what the decision was read from, and a handler that finds
 * it moved starts over with a fresh read of both.
 */
export async function applyAccountStatusChange(
  deps: StripeConnectDeps,
  accountId: string,
): Promise<AccountUpdateOutcome> {
  for (let attempt = 1; attempt <= MAX_STATUS_ATTEMPTS; attempt += 1) {
    const outcome = await attemptAccountStatusChange(deps, accountId);

    if (outcome !== null) {
      return outcome;
    }
  }

  throw conflict('That vendor account is being updated by another delivery');
}

/** One read-decide-write pass; `null` when the row changed before the write. */
async function attemptAccountStatusChange(
  deps: StripeConnectDeps,
  accountId: string,
): Promise<AccountUpdateOutcome | null> {
  const vendor = await findVendorProfileByStripeAccountId(deps.db, accountId);
  if (!vendor) {
    return 'ignored';
  }

  const status = await deps.stripe.readAccountStatus(accountId);
  const onboarded = isOnboarded(status);

  if (isMissingPayoutsOnly(status)) {
    deps.log?.warn(
      { stripeAccountId: accountId, vendorId: vendor.id },
      'Stripe can transfer to this vendor but not pay them out — no external account attached',
    );
  }

  /*
   * All three move together, and the early return has to test all three (#432).
   *
   * It used to compare the flag alone, which was right while the flag was the
   * entire record. It is not any more: Stripe adds a requirement to an account
   * that is *already* not onboarded — the ordinary case, since requirements are
   * what keep it not onboarded — and comparing the flag would return
   * `unchanged` and drop the reason on the floor, leaving the console showing
   * yesterday's answer with nothing to say it was stale.
   */
  const flagChanged = onboarded !== vendor.stripeOnboarded;
  const reasonChanged = (status.disabledReason ?? null) !== vendor.stripeDisabledReason;
  const requirementsChanged = !sameRequirements(
    status.requirementsDue,
    vendor.stripeRequirementsDue,
  );

  if (!flagChanged && !reasonChanged && !requirementsChanged) {
    return 'unchanged';
  }

  const written = await updateVendorStripeStatusIfUnchanged(deps.db, vendor, statusPatch(status));

  if (!written) {
    return null;
  }

  /*
   * The row now says what this read said, and a read can be older than one
   * another handler made meanwhile (VEN-547). That handler saw the row before
   * this write, found nothing to change against its own newer read, and wrote
   * nothing — so this write is the last and nothing would ever put the newer
   * answer back: a vendor Stripe had restricted stayed onboarded until the next
   * account event. So ask Stripe again after writing, and correct the row if it
   * has moved on. The correction is conditional like the write, and a handler
   * that finds the row moved again starts over.
   */
  const latest = await readLatestStatus(deps, accountId);
  let finalOnboarded = onboarded;

  if (latest && !sameStatus(statusPatch(latest), statusPatch(status))) {
    const corrected = await updateVendorStripeStatusIfUnchanged(
      deps.db,
      written,
      statusPatch(latest),
    );

    /*
     * A row that moved again was written by a handler that read it after this
     * write, so the decision is its to make; this one has already flipped the
     * flag and still owes the notice, which a retry could not send.
     */
    if (corrected) {
      finalOnboarded = isOnboarded(latest);
    }
  }

  /*
   * The outcome still names what happened to the **flag**, because that is what
   * the webhook's response and its log line have always meant and what the
   * vendor's payout gate turns on. A reason-only change is `unchanged` from
   * that vantage point and is still persisted above, and so is a flag that a
   * correction returned to where it started: nothing changed for the vendor.
   */
  if (finalOnboarded === vendor.stripeOnboarded) {
    return 'unchanged';
  }

  /*
   * Only a flag flip reaches here, and only the writer whose guarded update
   * landed, so a redelivery (`unchanged`) and a losing handler both stay quiet.
   * The notice goes to the vendor's own user, never to a customer.
   */
  if (deps.notify) {
    const notice = finalOnboarded ? PAYOUT_NOTICES.connected : PAYOUT_NOTICES.paused;

    await notifyVendorUser(deps.notify, vendor.userId, { ...notice, data: {} });
  }

  return finalOnboarded ? 'onboarded' : 'not-onboarded';
}

/**
 * The confirming read after a write. A failure here is not the write's: the row
 * already holds the answer, and throwing would have Stripe redeliver into an
 * `unchanged` that never sends the notice.
 */
async function readLatestStatus(
  deps: StripeConnectDeps,
  accountId: string,
): Promise<StripeAccountStatus | null> {
  try {
    return await deps.stripe.readAccountStatus(accountId);
  } catch (error) {
    deps.log?.warn(
      { err: error, stripeAccountId: accountId },
      'Could not re-read the Stripe account after writing its status; the next event will',
    );

    return null;
  }
}

/** The columns one Stripe read decides. */
function statusPatch(
  status: StripeAccountStatus,
): Pick<NewVendorProfileRow, 'stripeOnboarded' | 'stripeDisabledReason' | 'stripeRequirementsDue'> {
  return {
    stripeOnboarded: isOnboarded(status),
    stripeDisabledReason: status.disabledReason,
    stripeRequirementsDue: status.requirementsDue,
  };
}

function sameStatus(a: ReturnType<typeof statusPatch>, b: ReturnType<typeof statusPatch>): boolean {
  return (
    a.stripeOnboarded === b.stripeOnboarded &&
    (a.stripeDisabledReason ?? null) === (b.stripeDisabledReason ?? null) &&
    sameRequirements(a.stripeRequirementsDue ?? [], b.stripeRequirementsDue ?? [])
  );
}

/** Order-sensitive comparison — Stripe returns the entries in a stable order. */
function sameRequirements(next: readonly string[], current: readonly string[]): boolean {
  return next.length === current.length && next.every((item, index) => item === current[index]);
}
