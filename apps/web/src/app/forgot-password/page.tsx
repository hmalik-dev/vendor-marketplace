import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { redirectIfSignedIn } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Forgot password') };

export default async function ForgotPasswordPage(): Promise<React.ReactElement> {
  await redirectIfSignedIn();

  return (
    <AuthScreen headline="Forgot your password?" subhead="We'll email you a code to reset it.">
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
