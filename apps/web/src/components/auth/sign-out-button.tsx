'use client';

import { Slot } from 'radix-ui';
import { signOut } from '@/lib/auth/auth-requests';

interface SignOutButtonProps {
  /** Exactly one element; it receives the click handler. */
  children: React.ReactNode;
  /** Where signing out lands. */
  redirectUrl?: string;
}

/**
 * Ends the session through the app's own proxy and navigates home. A full
 * navigation rather than a router push, so every server-rendered surface —
 * header, footer, the role-gated layouts — is rebuilt signed out and no client
 * cache holds the last person's data. The account menu is ours end to end: the
 * visitor never reaches a provider-hosted panel.
 */
export function SignOutButton({
  children,
  redirectUrl = '/',
}: SignOutButtonProps): React.ReactElement {
  return (
    <Slot.Root
      onClick={() => {
        const leave = (): void => window.location.assign(redirectUrl);

        /* Leave either way: a failed call must not strand someone on a page that says they are in. */
        void signOut().then(leave, leave);
      }}
    >
      {children}
    </Slot.Root>
  );
}
