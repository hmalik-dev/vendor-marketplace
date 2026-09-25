'use client';

import { Slot } from 'radix-ui';
import { toast } from 'sonner';
import { AUTH_COPY } from '@/app/auth-copy';
import { signOut } from '@/lib/auth/auth-requests';
import { endSession } from '@/lib/auth/session-ended';

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
 *
 * A failed call stays on the page instead (VEN-628): navigating home anyway
 * left someone looking at a page that reads signed-out while the cookie was
 * never actually revoked, which is worse than staying put and saying so. A
 * toast rather than inline copy, because this one control renders inside a
 * dropdown menu item, a drawer row and a footer link — three places with no
 * room of their own for a sentence.
 */
export function SignOutButton({
  children,
  redirectUrl = '/',
}: SignOutButtonProps): React.ReactElement {
  return (
    <Slot.Root
      onClick={() => {
        void signOut().then(
          () => endSession(redirectUrl),
          () => toast.error(AUTH_COPY.unreachable),
        );
      }}
    >
      {children}
    </Slot.Root>
  );
}
