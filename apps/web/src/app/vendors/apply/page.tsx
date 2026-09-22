import {
  VENDOR_DETAILS_PATH,
  VENDOR_SIGN_UP_PATH,
  WAITLIST_PATH,
} from '@vendor-marketplace/shared';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';
import { getMyVendorApplication } from '@/lib/vendor-data';

export const dynamic = 'force-dynamic';

/**
 * Retired (VEN-512): the free-text application form this route used to serve
 * is gone, replaced by the details screen a refused vendor's sign-up already
 * lands on. Kept only so an old link still goes somewhere sensible.
 */
export default async function VendorApplyRedirectPage(): Promise<never> {
  const session = await getServerSession();

  if (!session) {
    redirect(VENDOR_SIGN_UP_PATH);
  }

  const account = await readIdentityForSupport();

  if (account) {
    redirect(DASHBOARD_PATH_BY_ROLE[account.role]);
  }

  const application = await getMyVendorApplication();

  redirect(application.complete ? WAITLIST_PATH : VENDOR_DETAILS_PATH);
}
