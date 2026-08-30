'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import type { NavDrawerLink } from '@/components/nav-drawer';
import { cn } from '@/lib/utils';

/**
 * The three links frame `01 Landing` draws beside the wordmark.
 *
 * They exist on the landing header and nowhere else: frame `02 Search` fills
 * the same space with the compact search bar, and every signed-in frame fills
 * it with Dashboard / Messages / Bookings. Rendering them everywhere would
 * contradict two frames to satisfy one, so the nav is scoped to `/`.
 *
 * "For vendors" is the vendor door. The header carries a single **Sign up**
 * pill for both account types, so this is where a vendor gets a path that
 * names them — and it deep-links with the role pre-selected rather than
 * scrolling to a section, because a visitor who clicks it has already decided
 * which side they are on. See design/design-plan/21-sign-up.md.
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
  { label: 'For vendors', href: '/sign-up?role=vendor' },
];

export function MarketingNav(): React.ReactElement | null {
  const pathname = usePathname();

  if (pathname !== '/') {
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
          className={cn(MARKETING_LINK_CLASS, link.tabletHidden === true && 'max-lg:hidden')}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
