import {
  BRAND_NAME,
  pageTitle,
  VENDOR_DETAILS_PATH,
  VENDOR_SIGN_UP_PATH,
} from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { WaitlistHomeLink } from '@/components/vendors/waitlist-home-link';
import { getServerSession } from '@/lib/auth/server';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';
import { getMyVendorApplication } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle("You're on the waitlist") };

export const dynamic = 'force-dynamic';

/**
 * The waitlist's terminal screen (VEN-512): nothing to do here until the
 * operator invites this address. No form, no button, no progress indicator —
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
      subhead={`We'll email ${application.email} once we invite you to open a vendor account on ${BRAND_NAME}.`}
      panel="vendor"
    >
      <div className="flex justify-center text-sm">
        <WaitlistHomeLink>Back to {BRAND_NAME}</WaitlistHomeLink>
      </div>
    </AuthScreen>
  );
}
