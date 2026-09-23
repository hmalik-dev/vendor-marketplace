import { pageTitle, VENDOR_DETAILS_PATH, WAITLIST_PATH } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AcceptTermsScreen } from '@/components/legal/accept-terms-screen';
import { getServerSession } from '@/lib/auth/server';
import { tokenEmail } from '@/lib/auth/token-expiry';
import { legalDocument } from '@/lib/legal-content';
import { getTermsStatus } from '@/lib/legal-data';
import { pathReturningTo, RETURN_PATH_PARAM, safeReturnPath } from '@/lib/return-path';

const terms = legalDocument('terms');

export const metadata: Metadata = { title: pageTitle('Accept the Terms') };

/**
 * The first-sign-in acceptance gate.
 *
 * Every account traverses this exactly once, however it was created — which is
 * why it is here rather than inside the sign-up form: no account row exists in
 * our database until this is accepted, and a person who verifies their email
 * one day and signs in the next still has to pass it. It is also where the role
 * chosen at sign-up reaches the API, because the identity provider has no field
 * to carry it.
 *
 * `force-dynamic`, because what it renders depends on the caller's own
 * acceptance and changes the moment they tick the box.
 */
export const dynamic = 'force-dynamic';

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  /*
   * The URL is untrusted input like any other. `safeReturnPath` drops anything
   * that is not a same-origin path, so the destination carried through the gate
   * cannot be widened into an open redirect.
   *
   * Read **before** the already-accepted branch below, because that branch
   * needs it too: every other hop in this flow carries the destination, and one
   * that quietly dropped it would land a reader on their role's default with
   * whatever they were doing lost.
   */
  const raw = (await searchParams)[RETURN_PATH_PARAM];
  const returnTo = safeReturnPath(Array.isArray(raw) ? raw[0] : raw);

  const status = await getTermsStatus();

  /*
   * Already accepted: there is nothing to do here, and leaving the screen up
   * would offer a second acceptance of a version already held — which the
   * service answers rather than writes, but which no reader should be shown.
   * Reachable by accepting in a second tab and reloading this one.
   * `/after-sign-in` resolves the role and re-validates where to forward.
   */
  if (status.accepted) {
    redirect(pathReturningTo('/after-sign-in', returnTo));
  }

  /*
   * A returning refused vendor (VEN-512): no account exists for this address
   * (it never can, while the gate refuses it) and a waitlist row already does
   * — from an earlier refusal or an earlier visit to the details screen. Sent
   * straight on rather than asked to confirm a role that would only be
   * refused again. Every protected route's `TERMS_REQUIRED` funnels here
   * (`redirectIfTermsRequired`, `signedInFailurePath`), so this is also what
   * makes AC18 true: a waitlisted session redirected to `/accept-terms` from
   * anywhere lands on `/waitlist`, not a screen it can never clear.
   */
  if (status.vendorWaitlist.exists) {
    redirect(status.vendorWaitlist.complete ? WAITLIST_PATH : VENDOR_DETAILS_PATH);
  }

  /* The signed-in address, so the screen reads only the sign-up role remembered for it. `cache()`d: no second round trip. */
  const session = await getServerSession();
  const email = session ? tokenEmail(session.token) : null;

  return <AcceptTermsScreen status={status} terms={terms} returnTo={returnTo} email={email} />;
}
