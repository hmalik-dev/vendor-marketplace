import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { redirectIfSignedIn } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Set a new password') };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  await redirectIfSignedIn();

  const raw = (await searchParams).email;
  const email = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  return (
    <AuthScreen headline="Set a new password" subhead="Enter the code we emailed you.">
      <ResetPasswordForm initialEmail={email} />
    </AuthScreen>
  );
}
