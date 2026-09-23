'use client';

import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { DropdownMenu } from 'radix-ui';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * The signed-in account control: the reader's avatar, opening a menu of the
 * things an account holder does from the header (VEN-403).
 *
 * **It replaces the identity provider's account menu, and it must never grow a
 * way back into one.** Users never reach a hosted panel; the owner does. That
 * menu opened a hosted profile, where a person could change their email address or delete
 * their account with no request through our API — so D39's refusal to close an
 * account holding a future confirmed booking could not answer it, and an email
 * change there was the only way to cause the mirror race VEN-386 repairs. A
 * person who needs either now goes through `Contact support`, and the owner
 * acts. `app/auth-account-surfaces.test.ts` fails the tree if a provider account
 * surface is imported anywhere.
 *
 * `Account settings` is the app's own page (VEN-677): changing a password
 * lives there, behind the proxy's rules. Email and closure stay out of it.
 *
 * The same menu sits in the admin console's header (ruled by the account
 * holder on VEN-677), in the console's ink `tone` and with its dashboard row
 * pointing at the console itself.
 */

/** Where signing out lands, stated rather than inherited from a provider's config. */
export const SIGN_OUT_REDIRECT = '/';

export interface AccountLink {
  label: string;
  href: string;
}

export const ACCOUNT_SETTINGS_PATH = '/account/settings';

/**
 * The menu's three links, shared with the drawer that carries the same rows at
 * narrow widths — one list, so the bar and the drawer cannot disagree.
 */
export function accountLinks(
  dashboardLabel: string,
  dashboardHref = '/dashboard',
): readonly [AccountLink, AccountLink, AccountLink] {
  return [
    { label: dashboardLabel, href: dashboardHref },
    { label: 'Account settings', href: ACCOUNT_SETTINGS_PATH },
    { label: 'Contact support', href: '/support' },
  ];
}

export interface AccountMenuProps {
  /** The reader's name from our own record, never the session's claims. */
  name: string;
  avatarUrl: string | null;
  /** `DASHBOARD_LABEL_BY_ROLE` for this reader, resolved once by the header. */
  dashboardLabel: string;
  /** Where that row goes: `/dashboard` resolves the role; the console names itself. */
  dashboardHref?: string;
  /**
   * `dark` on the admin console's ink header: frame `13`'s 30px monogram in the
   * inverted pair, rather than the site header's 32px one.
   */
  tone?: 'light' | 'dark';
}

/**
 * The row geometry is the dropdown shell's, as `admin/row-menu.tsx` takes it:
 * 44px rows inset in a 6px-padded panel, highlight carried by the fill.
 */
const ITEM_CLASS =
  'flex h-11 w-full cursor-pointer items-center rounded-md px-3 text-left text-meta font-semibold text-stone-900 outline-none select-none data-[highlighted]:bg-stone-150 data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-clay-400';

export function AccountMenu({
  name,
  avatarUrl,
  dashboardLabel,
  dashboardHref,
  tone = 'light',
}: AccountMenuProps): React.ReactElement {
  const trigger = useRef<HTMLButtonElement>(null);
  // Controlled only so `Tab` can close it — see the handler on the content.
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        ref={trigger}
        aria-label="Account menu"
        /*
          44px of target around the frame's 32px circle, per `04-laws.md`. No
          `data-focus-own`: this is an unbordered control, and the base
          `:focus-visible` rule in `globals.css` paints exactly the clay offset
          ring the law asks for.
        */
        className={cn(
          'flex size-11 cursor-pointer items-center justify-center rounded-full',
          // The console's 30px circle keeps frame `13`'s position: the target's extra 7px a side overlaps.
          tone === 'dark' && '-mx-[7px]',
        )}
      >
        {/* Decorative: the trigger's label names the control. */}
        {tone === 'dark' ? (
          <Avatar name={name} src={avatarUrl} size="xs" className="bg-stone-700 text-clay-150" />
        ) : (
          <Avatar name={name} src={avatarUrl} size="header" />
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          // The panel's highlight is its fill, so the global ring steps aside —
          // the same reason `row-menu.tsx` gives.
          data-focus-own
          /*
            Tab closes the menu and parks focus on the trigger — the ARIA
            menu-button convention #435 ruled for `admin/row-menu.tsx`, which
            explains why "moves on" is not attempted. Without this Radix
            swallows the key and the panel stays open with focus inside it.
          */
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
          className="z-50 flex min-w-[13rem] flex-col rounded-panel border border-stone-300 bg-stone-0 p-[6px] shadow-dropdown"
        >
          {accountLinks(dashboardLabel, dashboardHref).map((link) => (
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
