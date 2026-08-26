import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';
import { redirectIfSignedIn } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Sign in · VenMatch' };

export default async function SignInPage(): Promise<React.ReactElement> {
  await redirectIfSignedIn();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <h1 className="mb-8 font-display text-3xl font-semibold text-stone-800">Welcome back</h1>
      {/* `/after-sign-in` resolves the role from the local record and forwards on. */}
      <SignIn fallbackRedirectUrl="/after-sign-in" />
    </div>
  );
}
