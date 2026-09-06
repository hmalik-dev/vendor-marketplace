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

  /*
   * `hideTriggerFrom="md"` because `14 Landing tablet` draws this bar at 768
   * with its links showing and no hamburger. The signed-in drawer keeps the
   * default, which `14 Search tablet` draws.
   */
  return <NavDrawer links={MARKETING_LINKS} hideTriggerFrom="md" />;
}

export interface SignedInDrawerProps {
  /**
   * What the `/dashboard` row is called for this reader.
   *
   * Passed in rather than resolved here: this is a Client Component and the
   * role lives on the server, and the drawer holds the *same* control the bar
   * hides below `sm` — so one label, resolved once, in
   * `DASHBOARD_LABEL_BY_ROLE`. Two copies of that decision is how the bar and
   * the drawer end up calling one destination two things.
   */
  dashboardLabel: string;
}

export function SignedInDrawer({ dashboardLabel }: SignedInDrawerProps): React.ReactElement {
  return (
    <NavDrawer
      links={[
        { label: dashboardLabel, href: '/dashboard' },
        { label: 'Messages', href: '/messages' },
      ]}
    />
  );
}
