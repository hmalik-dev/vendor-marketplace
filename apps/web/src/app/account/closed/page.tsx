import type { Metadata } from 'next';
import Link from 'next/link';
import { pageTitle } from '@vendor-marketplace/shared';

export const metadata: Metadata = {
  title: pageTitle('Account closed'),
  robots: { index: false, follow: false },
};

/**
 * Where a person lands once they have closed their own account (VEN-680).
 * Public on purpose: by the time it renders there is no session to check, and
 * nothing on it depends on one.
 */
export default function AccountClosedPage(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-xl px-6 pt-10 pb-16">
      <h1 className="font-display text-[33px] leading-[1.1] text-stone-900">
        Your account is closed
      </h1>
      <p className="mt-4 text-base text-stone-700">
        You are signed out everywhere. Payment and booking records that others still need are kept.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-stone-900 underline">
        Back to the home page
      </Link>
    </div>
  );
}
