'use client';

import Link from 'next/link';
import { signOut } from '@/lib/auth/auth-requests';

/**
 * "Back to {BRAND_NAME}" on `/waitlist` (VEN-512): the screen's only control,
 * and it signs the reader out first. Never a link straight to a sign-out URL —
 * a GET that signs out would fire on link prefetch and on any cross-site
 * request — so this is a real click handler that calls the sign-out request
 * and only then navigates.
 */
export function WaitlistHomeLink({ children }: { children: React.ReactNode }): React.ReactElement {
  function leave(event: React.MouseEvent): void {
    event.preventDefault();
    const go = (): void => window.location.assign('/');
    void signOut().then(go, go);
  }

  return (
    <Link href="/" onClick={leave} className="font-semibold text-clay-500">
      {children}
    </Link>
  );
}
