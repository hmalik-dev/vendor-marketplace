import {
  BRAND_NAME,
  pageTitle,
  VENDOR_DETAILS_PATH,
  VENDOR_SIGN_UP_PATH,
} from '@vendor-marketplace/shared';
import { CheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { WaitlistHomeLink } from '@/components/vendors/waitlist-home-link';
import { getServerSession } from '@/lib/auth/server';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';
import { getMyVendorApplication } from '@/lib/vendor-data';

/**
 * The 46px sage mark (frame `37`): "sage, and only once… never as a full-width
 * banner — a banner would imply there's a page underneath it still to deal
 * with." Settled, per `40-states.md`.
 */
function SettledMark(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="mx-auto mb-5.5 flex size-11.5 items-center justify-center rounded-full border border-sage-300 bg-sage-50"
    >
      <CheckIcon className="size-3.75 text-sage-400" strokeWidth={2.5} />
    </div>
  );
}

export const metadata: Metadata = { title: pageTitle("You're on the waitlist") };

export const dynamic = 'force-dynamic';

/**
 * The waitlist's terminal screen (VEN-512): nothing to do here until the
 * admin invites this address. No form, no button, no progress indicator —
 * only a way back that also signs the person out, so nobody sits signed in to
 * an app they cannot use.
 */
export default async function WaitlistPage(): Promise<React.ReactElement> {
  const session = await getServerSession();

  if (!session) {
    redirect(VENDOR_SIGN_UP_PATH);
  }

  const account = await readIdentityForSupport();

  if (account) {
    redirect(DASHBOARD_PATH_BY_ROLE[account.role]);
  }

  const application = await getMyVendorApplication();

  if (!application.complete) {
    redirect(VENDOR_DETAILS_PATH);
  }

  return (
    <AuthScreen
      headline="You're on the waitlist"
      subhead={
        <>
          {`We've saved `}
          <strong className="font-semibold text-stone-900">{application.email}</strong>
          {`. We'll email you when you're invited. Then sign in with this same address and `}
          {`you'll land in your new vendor account. There's nothing else you need to do.`}
        </>
      }
      photo={false}
      beforeHeadline={<SettledMark />}
    >
      <div className="mt-7.5 flex justify-center border-t border-stone-300 pt-5.5 text-base">
        <WaitlistHomeLink>Back to {BRAND_NAME}</WaitlistHomeLink>
      </div>
    </AuthScreen>
  );
}
