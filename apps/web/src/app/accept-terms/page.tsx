import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AcceptTermsScreen } from '@/components/legal/accept-terms-screen';
import { legalDocument } from '@/lib/legal-content';
import { getTermsStatus } from '@/lib/legal-data';
import { pathReturningTo, RETURN_PATH_PARAM, safeReturnPath } from '@/lib/return-path';

const terms = legalDocument('terms');

export const metadata: Metadata = { title: pageTitle('Accept the Terms') };

/**
 * The first-sign-in acceptance gate.
 *
 * Every account traverses this exactly once, however it was created — which is
 * why it is here rather than inside the sign-up form. `sign-up-form.tsx`
 * renders Clerk's prebuilt `<SignUp>`, so there is no seam in that form to put
 * a checkbox in, and a box on the role step before it is bypassed by every
 * social sign-up that enters Clerk directly.
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

  return <AcceptTermsScreen status={status} terms={terms} returnTo={returnTo} />;
}
