'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';

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
const LINKS = [
  { label: 'Browse', href: '/search' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For vendors', href: '/sign-up?role=vendor' },
] as const;

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
