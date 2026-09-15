'use client';

import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { DropdownMenu } from 'radix-ui';
import { Avatar } from '@/components/ui/avatar';

/**
 * The signed-in account control: the reader's avatar, opening a menu of the
 * three things an account holder does from the header (VEN-403).
 *
 * **It replaces Clerk's `UserButton`, and it must never grow a way back into
 * Clerk.** Users never access Clerk; the owner does. Clerk's menu opened its
 * hosted profile, where a person could change their email address or delete
 * their account with no request through our API — so D39's refusal to close an
 * account holding a future confirmed booking could not answer it, and an email
 * change there was the only way to cause the mirror race VEN-386 repairs. A
 * person who needs either now goes through `Contact support`, and the owner
 * acts. `app/clerk-account-surfaces.test.ts` fails the tree if a Clerk account
 * surface is imported anywhere.
 *
 * There is no settings row because there is no settings screen to link to.
 */

/** Where signing out lands, stated rather than inherited from Clerk's config. */
export const SIGN_OUT_REDIRECT = '/';

export interface AccountLink {
  label: string;
  href: string;
}

/**
 * The menu's two links, shared with the drawer that carries the same rows at
 * narrow widths — one list, so the bar and the drawer cannot disagree.
 */
export function accountLinks(dashboardLabel: string): readonly [AccountLink, AccountLink] {
  return [
    { label: dashboardLabel, href: '/dashboard' },
    { label: 'Contact support', href: '/support' },
  ];
}

export interface AccountMenuProps {
  /** The reader's name from our own record, never Clerk's session claims. */
  name: string;
  avatarUrl: string | null;
  /** `DASHBOARD_LABEL_BY_ROLE` for this reader, resolved once by the header. */
  dashboardLabel: string;
}

/**
 * The row geometry is the dropdown shell's, as `admin/row-menu.tsx` takes it:
 * 44px rows inset in a 6px-padded panel, highlight carried by the fill.
 */
const ITEM_CLASS =
  'flex h-11 w-full cursor-pointer items-center rounded-md px-3 text-left text-meta font-semibold text-stone-900 outline-none select-none data-[highlighted]:bg-stone-150';

export function AccountMenu({
  name,
  avatarUrl,
  dashboardLabel,
}: AccountMenuProps): React.ReactElement {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        /*
          44px of target around the frame's 32px circle, per `04-laws.md`. No
          `data-focus-own`: this is an unbordered control, and the base
          `:focus-visible` rule in `globals.css` paints exactly the clay offset
          ring the law asks for.
        */
        className="flex size-11 cursor-pointer items-center justify-center rounded-full"
      >
        {/* Decorative: the trigger's label names the control. */}
        <Avatar name={name} src={avatarUrl} size="header" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          // The panel's highlight is its fill, so the global ring steps aside —
          // the same reason `row-menu.tsx` gives.
          data-focus-own
          className="z-50 flex min-w-[13rem] flex-col rounded-panel border border-stone-300 bg-stone-0 p-[6px] shadow-dropdown"
        >
          {accountLinks(dashboardLabel).map((link) => (
            <DropdownMenu.Item key={link.href} asChild data-focus-own>
              <Link href={link.href} className={ITEM_CLASS}>
                {link.label}
              </Link>
            </DropdownMenu.Item>
          ))}
          {/*
            `SignOutButton` outermost: it clones its one child with a click
            handler, and `Item asChild` hands that handler on to the button, so
            there is one focusable element and it is a menu item.
          */}
          <SignOutButton redirectUrl={SIGN_OUT_REDIRECT}>
            <DropdownMenu.Item asChild data-focus-own>
              <button type="button" className={ITEM_CLASS}>
                Sign out
              </button>
            </DropdownMenu.Item>
          </SignOutButton>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
