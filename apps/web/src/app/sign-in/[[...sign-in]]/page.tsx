import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { pageTitle } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { redirectIfSignedIn } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Sign in') };

export default async function SignInPage(): Promise<React.ReactElement> {
  await redirectIfSignedIn();

  return (
    <AuthScreen headline="Welcome back" subhead="Pick up where you left off.">
      {/* `/after-sign-in` resolves the role from the local record and forwards on. */}
      <SignIn fallbackRedirectUrl="/after-sign-in" />
    </AuthScreen>
  );
}
