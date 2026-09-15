'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEGAL_PATHS } from '@vendor-marketplace/shared';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { FOR_VENDORS_PATH } from '@/lib/for-vendors';
import type { NavDrawerLink } from '@/components/nav-drawer';
import { cn } from '@/lib/utils';

/**
 * The three links frame `01 Landing` draws beside the wordmark.
 *
 * They exist on the landing header and on the legal pages, and nowhere else:
 * frame `02 Search` fills the same space with the compact search bar, and every
 * signed-in frame fills it with Dashboard / Messages / Bookings. Rendering them
 * everywhere would contradict two frames to satisfy one, so the nav is scoped.
 *
 * **Frame `31` is the case that ruling did not have.** The legal pages draw the
 * signed-out header *with* these three links, and they are the one public
 * surface that puts nothing else in that space — so carrying the nav there
 * satisfies a third frame without contradicting either of the two the original
 * scoping protected.
 *
 * "For vendors" is the vendor door. The header carries a single **Sign up**
 * pill for both account types, so this is where a vendor gets a path that
 * names them. It opens `/for-vendors` — what a vendor keeps and when they are
 * paid — rather than a sign-up form, which a visitor who already holds an
 * account would only be bounced out of. That page carries the nav too, with
 * this link drawn active (the frame in `design/delta-vendors/`).
 */
/**
 * Exported so the mobile drawer carries the same links, never a second list.
 *
 * `tabletHidden` marks the one the 768 bar sheds. `14 Landing tablet` draws
 * **two** links — `Browse` and `For vendors` — while `27 Landing — 1024` draws
 * all three, and the one that gives way is the one that goes somewhere the
 * other two do not: `How it works` is an in-page anchor, so a visitor at 768
 * loses a scroll shortcut rather than a destination. The drawer below 768 still
 * carries all three.
 */
export const MARKETING_LINKS: readonly NavDrawerLink[] = [
  { label: 'Browse', href: '/search' },
  { label: 'How it works', href: '/#how-it-works', tabletHidden: true },
  { label: 'For vendors', href: FOR_VENDORS_PATH },
];

/** The pages that draw these links: the landing page, `/for-vendors` and the four legal reading pages. */
const NAV_PATH_SET = new Set<string>(['/', FOR_VENDORS_PATH, ...Object.values(LEGAL_PATHS)]);

/**
 * The frame's active treatment: clay-600 at 600 over a 2px clay-400 rule, 2px
 * below the text. A `before:` pseudo-element (the hit area already owns
 * `after:`), so the active link keeps its siblings' box and baseline.
 */
const ACTIVE_LINK_CLASS =
  "font-semibold text-clay-600 before:absolute before:inset-x-0 before:top-1/2 before:mt-[calc(0.5lh+2px)] before:h-0.5 before:bg-clay-400 before:content-['']";

export function MarketingNav(): React.ReactElement | null {
  const pathname = usePathname();

  if (!NAV_PATH_SET.has(pathname)) {
    return null;
  }

  return (
    /*
     * Visible from 768, not from 769.
     *
     * `14 Landing tablet` draws the links in the bar at 768 with **no**
     * hamburger, so the drawer and the nav swap at 768 rather than overlapping
     * there. The old pair — `max-[768px]:hidden` here against
     * `min-[769px]:hidden` on the trigger — put 768 itself on the mobile side
     * of both, which is the one width the frame is drawn at.
     *
     * `14 Search tablet` genuinely does hold a hamburger at 768, which is what
     * the trigger's own comment cites; that frame is signed in and fills this
     * space with the search bar, so it has nowhere to put links. Landing does.
     *
     * The gaps are the frames': 24px at 1440, 20px at 1024, 16px at 768.
     */
    <div className="flex gap-4 max-md:hidden lg:gap-5 min-[90rem]:gap-6">
      {MARKETING_LINKS.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          aria-current={link.href === pathname ? 'page' : undefined}
          className={cn(
            MARKETING_LINK_CLASS,
            link.href === pathname && ACTIVE_LINK_CLASS,
            link.tabletHidden === true && 'max-lg:hidden',
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
