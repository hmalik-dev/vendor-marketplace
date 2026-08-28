'use client';

import { usePathname } from 'next/navigation';
import { MARKETING_LINKS } from '@/components/marketing-nav';
import { NavDrawer } from '@/components/nav-drawer';

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
 *   width. That was always a stopgap waiting on this drawer.
 */
export function SignedOutDrawer(): React.ReactElement | null {
  const pathname = usePathname();

  if (pathname !== '/') {
    return null;
  }

  return <NavDrawer links={MARKETING_LINKS} />;
}

const SIGNED_IN_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Messages', href: '/messages' },
] as const;

export function SignedInDrawer(): React.ReactElement {
  return <NavDrawer links={SIGNED_IN_LINKS} />;
}
