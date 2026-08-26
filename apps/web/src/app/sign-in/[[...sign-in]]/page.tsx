import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';

export const metadata: Metadata = { title: 'Sign in · VendorHub' };

export default function SignInPage(): React.ReactElement {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <h1 className="mb-8 font-display text-3xl font-semibold text-stone-800">Welcome back</h1>
      {/* `/dashboard` resolves the role from the local record and forwards on. */}
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
