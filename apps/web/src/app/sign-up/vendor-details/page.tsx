import {
  BRAND_NAME,
  pageTitle,
  VENDOR_SIGN_UP_PATH,
  WAITLIST_PATH,
} from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { VendorDetailsForm } from '@/components/vendors/vendor-details-form';
import { getServerSession } from '@/lib/auth/server';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';
import { getCategories, getMyVendorApplication } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Join the waitlist') };

/** Who is asking changes what renders, so no cached copy. */
export const dynamic = 'force-dynamic';

/**
 * The waitlist's details screen (VEN-512): where a verified vendor session the
 * gate refused lands, straight from the sign-up flow — never the Terms screen.
 * The row is written the moment this page is reached (`getMyVendorApplication`
 * seeds it), so nobody is lost by leaving before filling it in.
 */
export default async function VendorDetailsPage(): Promise<React.ReactElement> {
  // Unreachable signed-out: this screen only makes sense for a verified session.
  const session = await getServerSession();

  if (!session) {
    redirect(VENDOR_SIGN_UP_PATH);
  }

  // An account already exists for this address — it is not a refused vendor anymore.
  const account = await readIdentityForSupport();

  if (account) {
    redirect(DASHBOARD_PATH_BY_ROLE[account.role]);
  }

  const [application, categories] = await Promise.all([getMyVendorApplication(), getCategories()]);

  if (application.complete) {
    redirect(WAITLIST_PATH);
  }

  return (
    <AuthScreen
      headline="Tell us about your business"
      subhead={`Vendors join ${BRAND_NAME} by invitation for now. Add your details to join the waitlist.`}
      panel="vendor"
    >
      <VendorDetailsForm application={application} categories={categories} />
    </AuthScreen>
  );
}
