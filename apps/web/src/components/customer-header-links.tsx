'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MARKETING_LINK_CLASS } from '@/components/marketing-link';
import { cn } from '@/lib/utils';

/**
 * A signed-in customer's half of the header (VEN-760, the 2026-09-25 resync):
 * `Browse` back to discovery, then one `My bookings` pill in place of the
 * `Messages` and `Bookings` links. Nine frames draw it; `27 Vendor profile —
 * 1024` still draws the old pair and is the drift (D30).
 *
 * `Browse` is absent on `/search`, which is where it goes. The pill is tinted
 * on the hub itself — frames `07` and `19` — and on everything under it.
 * `/bookings` is the pill's href rather than `/dashboard`: this control is the
 * customer's alone, so there is no role left for the forwarder to resolve.
 */
export function CustomerHeaderLinks(): React.ReactElement {
  const pathname = usePathname();
  const onHub = pathname === '/bookings' || pathname.startsWith('/bookings/');

  return (
    <>
      {pathname === '/search' ? null : (
        <Link href="/search" className={cn(MARKETING_LINK_CLASS, 'max-sm:hidden')}>
          Browse
        </Link>
      )}
      {/*
        12.5px / 6 12 below 1440 and 13px / 7 14 at it, as the frames draw it.
        The 44px target is a centred pseudo-element, the `Sign up` pill's idiom,
        so the pill keeps the frame's height.
      */}
      <Link
        href="/bookings"
        aria-current={onHub ? 'page' : undefined}
        className={cn(
          "relative flex-none rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] min-[90rem]:px-3.5 min-[90rem]:py-[7px] min-[90rem]:text-[13px]",
          onHub
            ? 'border-clay-200 bg-clay-100 text-clay-600'
            : 'border-stone-300 bg-stone-0 text-stone-900 hover:text-clay-600',
        )}
      >
        My bookings
      </Link>
    </>
  );
}
