'use client';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@vendor-marketplace/shared';
import { accountLinksFor, roleHasMessages } from '@/components/account-links';
import { SIGN_OUT_REDIRECT } from '@/components/account-menu';
import { MARKETING_LINKS } from '@/components/marketing-nav';
import { NAV_DRAWER_ROW_CLASS, NavDrawer } from '@/components/nav-drawer';

/**
 * Decides what the drawer holds, and whether it should exist at all.
 *
 * A drawer that opens onto nothing is furniture, so each branch renders only
 * where it has something to carry:
 *
 * - **Signed out** it holds the marketing links, which frame `01` draws on the
 *   landing page and nowhere else. That `/`-scoping is deliberate — `02` fills
 *   the same space with the search bar — so the drawer inherits it rather than
 *   quietly reintroducing the nav on every screen. Off `/`, "Sign in" and the
 *   Sign up pill both stay in the bar and there is nothing left to put away.
 * - **Signed in** it holds Dashboard, which the header hides below `sm` for
 *   width, and every row of the avatar's account menu for the reader's role, `Messages` where the role has an inbox, and `Sign out` — so a narrow width loses nothing the menu offers (VEN-403).
 */
export function SignedOutDrawer(): React.ReactElement | null {
  const pathname = usePathname();

  if (pathname !== '/') {
    return null;
  }

  /*
   * `hideTriggerFrom="md"` because `14 Landing tablet` draws this bar at 768
   * with its links showing and no hamburger. The signed-in drawer keeps the
   * default, which `14 Search tablet` draws.
   */
  return <NavDrawer links={MARKETING_LINKS} hideTriggerFrom="md" />;
}

export interface SignedInDrawerProps {
  /**
   * The reader's role, which decides the rows: the same `accountLinksFor` list
   * the avatar menu reads, so the drawer, which holds the control the bar
   * hides below `sm`, names it what the bar does. `Messages` follows the first
   * row for the roles that have an inbox.
   */
  role: UserRole;
}

export function SignedInDrawer({ role }: SignedInDrawerProps): React.ReactElement {
  const [first, ...rest] = accountLinksFor(role);
  const messages = roleHasMessages(role) ? [{ label: 'Messages', href: '/messages' }] : [];

  return (
    <NavDrawer
      links={[...(first ? [first] : []), ...messages, ...rest]}
      action={
        <SignOutButton redirectUrl={SIGN_OUT_REDIRECT}>
          <button type="button" className={NAV_DRAWER_ROW_CLASS}>
            Sign out
          </button>
        </SignOutButton>
      }
    />
  );
}
