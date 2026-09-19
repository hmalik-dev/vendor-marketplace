import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { SignInForm } from '@/components/auth/sign-in-form';
import { redirectIfSignedIn } from '@/lib/current-user';
import { RETURN_PATH_PARAM, safeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: pageTitle('Sign in') };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  /*
   * Where the customer was going before they were asked to sign in. Untrusted:
   * `safeReturnPath` keeps it to a same-origin path, so this cannot be used to
   * bounce anyone off our origin. Anything it rejects falls back to the plain
   * post-sign-in routing, which is where a bare `/sign-in` visit already goes.
   *
   * Sign-in always lands on `/after-sign-in` with this carried as `returnTo`,
   * never straight on the destination: that handler does the role resolution,
   * the suspended-account branch and the re-validation.
   */
  const raw = (await searchParams)[RETURN_PATH_PARAM];
  const returnTo = safeReturnPath(Array.isArray(raw) ? raw[0] : raw);

  /*
   * Read *before* the signed-in guard runs, so somebody who signed in in
   * another tab and reloaded this page is forwarded to where they were going
   * rather than to their role's default start.
   */
  await redirectIfSignedIn(returnTo);

  return (
    <AuthScreen headline="Welcome back" subhead="Pick up where you left off.">
      {/* `/after-sign-in` resolves the role from the local record and forwards on. */}
      <SignInForm
        destination={
          returnTo
            ? `/after-sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(returnTo)}`
            : '/after-sign-in'
        }
      />
    </AuthScreen>
  );
}
