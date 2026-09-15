import { SignOutButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { BRAND_NAME, pageTitle, SUPPORT_PATH } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { VendorApplicationForm } from '@/components/vendors/vendor-application-form';
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';
import { readIdentityForSupport } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Apply to join as a vendor') };

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
  if ((await readIdentityForSupport())?.role === 'vendor') {
    redirect(DASHBOARD_PATH_BY_ROLE.vendor);
  }

  const session = await currentUser();
  const sessionEmail =
    session?.primaryEmailAddress?.emailAddress ?? session?.emailAddresses[0]?.emailAddress ?? null;

  return (
    <AuthScreen
      headline="Apply to join as a vendor"
      subhead={`Vendors join ${BRAND_NAME} by invitation for now. Tell us about your business.`}
      panel="vendor"
    >
      {sessionEmail ? (
        <p className="mb-5 text-sm leading-prose text-stone-700">
          No account was created for {sessionEmail}. Once you are invited, sign up again with this
          same email.
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
