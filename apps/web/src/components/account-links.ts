import type { UserRole } from '@vendor-marketplace/shared';
import { ACCOUNT_SETTINGS_PATH } from '@/components/account/settings-paths';
import { DASHBOARD_LABEL_BY_ROLE, DASHBOARD_PATH_BY_ROLE } from '@/lib/role-routes';

export interface AccountLink {
  label: string;
  href: string;
}

/**
 * The rows a role's account menu offers, in order and without `Sign out`,
 * which is a button and not a destination. The avatar menu and the drawer
 * both read this list, so the bar and the drawer cannot disagree about what a
 * role has (VEN-702).
 *
 * - A customer's `My profile` sat only in the bookings sidebar and the footer.
 * - A vendor's `Edit profile` stays in the rail and the footer, not here.
 * - An admin has no support inbox to write to: `Contact support` mails the one
 *   they own. Their console is `/admin`, named directly rather than through
 *   `/dashboard`'s role redirect.
 */
export function accountLinksFor(role: UserRole): readonly AccountLink[] {
  const settings = { label: 'Account settings', href: ACCOUNT_SETTINGS_PATH };

  switch (role) {
    case 'customer':
      return [
        { label: 'My bookings', href: '/dashboard' },
        { label: 'My profile', href: '/customer/profile' },
        settings,
        { label: 'Contact support', href: '/support' },
      ];
    case 'vendor':
      return [
        { label: DASHBOARD_LABEL_BY_ROLE.vendor, href: '/dashboard' },
        settings,
        { label: 'Contact support', href: '/support' },
      ];
    case 'admin':
      return [
        { label: DASHBOARD_LABEL_BY_ROLE.admin, href: DASHBOARD_PATH_BY_ROLE.admin },
        settings,
      ];
  }
}

/** Whether the role has a `/messages` inbox: an admin has no one to write to. */
export function roleHasMessages(role: UserRole): boolean {
  return role !== 'admin';
}
