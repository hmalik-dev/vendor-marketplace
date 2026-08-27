'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The three links frame `01 Landing` draws beside the wordmark.
 *
 * They exist on the landing header and nowhere else: frame `02 Search` fills
 * the same space with the compact search bar, and every signed-in frame fills
 * it with Dashboard / Messages / Bookings. Rendering them everywhere would
 * contradict two frames to satisfy one, so the nav is scoped to `/`.
 *
 * "For vendors" points at the on-page section that speaks to vendors rather
 * than a vendor marketing page, because there is no such page in MVP and a nav
 * item that leads nowhere is worse than one that leads somewhere short.
 */
const LINKS = [
  { label: 'Browse', href: '/search' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For vendors', href: '/#for-vendors' },
] as const;

/** The frame's nav-link treatment, shared with the header's "Sign in". */
export const MARKETING_LINK_CLASS =
  'text-[13.5px] font-medium text-stone-700 transition-colors duration-(--duration-fast) hover:text-clay-600';

export function MarketingNav(): React.ReactElement | null {
  const pathname = usePathname();

  if (pathname !== '/') {
    return null;
  }

  return (
    <div className="flex gap-6 max-md:hidden">
      {LINKS.map((link) => (
        <Link key={link.label} href={link.href} className={MARKETING_LINK_CLASS}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
