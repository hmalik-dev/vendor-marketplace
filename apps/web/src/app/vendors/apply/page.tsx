import { SignOutButton } from '@/components/auth/sign-out-button';
import { neonAuth } from '@/lib/auth/server';
import { BRAND_NAME, pageTitle, SUPPORT_PATH, VENDOR_APPLY_PATH } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { VendorApplicationForm } from '@/components/vendors/vendor-application-form';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Apply as a vendor') };

/** Who is asking changes the copy and the email field, so no cached copy. */
export const dynamic = 'force-dynamic';

/**
 * Where the vendor gate (VEN-406) sends a vendor it refused to create, and
 * where `/for-vendors` points while the gate is on.
 *
 * Deliberately unframed: it follows the sign-up panel (`21-sign-up.md`), with
 * the vendor photograph, because it is the same moment of the same journey.
 */
export default async function VendorApplyPage(): Promise<React.ReactElement> {
  /*
   * A vendor who already has an account has nothing to apply for. Read the way
   * `/support` reads it, never through the suspension redirect: the session the
   * gate sends here holds no accepted account, and `/users/me` answers it
   * `TERMS_REQUIRED` — which, on a gate-exempt path, would fall through to
   * `/suspended`.
   */
  const account = await readIdentityForSupport();

  if (account?.role === 'vendor') {
    redirect(DASHBOARD_PATH_BY_ROLE.vendor);
  }

  /*
   * Any other account already has a role, and a role is fixed at creation: an
   * application from it could only wait forever, and the API refuses it. Say so
   * instead of showing a form that cannot work or a sentence that is false about
   * their own account.
   */
  if (account) {
    return (
      <AuthScreen
        headline="You already have an account"
        subhead={`Vendor accounts are opened with a new email address. ${BRAND_NAME} accounts cannot change role.`}
        panel="vendor"
      >
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link
            href={DASHBOARD_PATH_BY_ROLE[account.role]}
            className="font-semibold text-clay-500 underline underline-offset-4"
          >
            Back to {BRAND_NAME}
          </Link>
          <SignOutButton redirectUrl={VENDOR_APPLY_PATH}>
            <Button type="button" variant="ghost" size="sm">
              Sign out to apply with another address
            </Button>
          </SignOutButton>
        </div>
      </AuthScreen>
    );
  }

  const { data: session } = await neonAuth().getSession();
  const sessionEmail = session?.user.email ?? null;

  return (
    <AuthScreen
      headline="Apply to join as a vendor"
      subhead={`Vendors join ${BRAND_NAME} by invitation for now. Tell us about your business.`}
      panel="vendor"
    >
      {sessionEmail ? (
        <p className="mb-5 text-sm leading-prose text-stone-700">
          No account was created for {sessionEmail}. Once you are invited, sign in with this same
          email.
        </p>
      ) : null}

      <VendorApplicationForm sessionEmail={sessionEmail} />

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
        <Link
          href={SUPPORT_PATH}
          className="font-semibold text-clay-500 underline underline-offset-4"
        >
          Contact support
        </Link>
        {sessionEmail ? (
          <SignOutButton redirectUrl="/">
            <Button type="button" variant="ghost" size="sm">
              Sign out
            </Button>
          </SignOutButton>
        ) : null}
      </div>
    </AuthScreen>
  );
}
