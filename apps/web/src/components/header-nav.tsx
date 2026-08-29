'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * The header's `<nav>`, whose horizontal inset follows the route.
 *
 * The inset is not one number across the product — the frames set it per
 * screen. `.hd` defaults to `padding:0 32px`; frames `01 Landing`, `15 404`,
 * `16 Server error` and `28 Dropdown open — hero` override it to 40px, and the
 * three search frames — `02 Search`, `17 Search loading` and
 * `18 Search no results` — override it to 26px. Search is the only route whose
 * header disagreed with the page beneath it: `SearchShell` and `RefineBar`
 * already inset their content by 26px at 1440, so a 40px header put the
 * wordmark 14px right of every edge below it.
 *
 * Only the 1440 step moves. The frames below 1440 are a separate ruling (the
 * 1024 search frames inset the page by 24px, the tablet header by 20px) and
 * nothing here should pre-empt it, so this narrows the inset exactly where
 * frame `02` is the acceptance criterion and leaves every smaller width alone.
 *
 * A client component because the route is what selects the inset, and the
 * header itself is a Server Component. The children are passed through rather
 * than imported here, so the Clerk auth cluster stays server-rendered — the
 * same reason `MarketingNav` and `HeaderQuery` are small.
 */

/** `min-[90rem]` is 1440, the viewport every desktop frame is drawn at. */
const SEARCH_INSET = 'min-[90rem]:px-6.5';

/**
 * 32px — the `.hd` default itself, which the vendor chrome frames take
 * unmodified (`08`, `09`, `10`, `11`). Counted across the bundle: 21 of the 36
 * headers use the bare class, and only 4 override it to the 40px `BASE` below.
 * So 40px is the exception the frames spell out, not the rule.
 *
 * `BASE` is nonetheless left at 40px rather than corrected to 32px, because
 * frames `15 404` and `16 Server error` are two of the four that draw 40px and
 * neither has a stable pathname to key off — a 404 answers any unmatched URL.
 * Narrowing the default would silently move both. The other 17 base-`.hd`
 * frames are still on 40px and that is a real finding, but it belongs to the
 * lanes that own those screens rather than to this one.
 */
const VENDOR_INSET = 'lg:px-8';

/**
 * The routes carrying the vendor chrome — frames `08`, `09` and `11` under
 * `/vendor`, and frame `10 Messaging` at `/messages`, which draws the same
 * header down to the `Vendor` chip.
 */
const VENDOR_ROUTES = ['/vendor', '/messages'] as const;

const BASE = 'flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10';

export interface HeaderNavProps {
  children: React.ReactNode;
}

export function HeaderNav({ children }: HeaderNavProps): React.ReactElement {
  const pathname = usePathname();

  const isVendorChrome = VENDOR_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <nav
      aria-label="Main"
      className={cn(
        BASE,
        pathname === '/search' && SEARCH_INSET,
        // Last, so it overrides `BASE`'s own `lg` step rather than racing it.
        isVendorChrome && VENDOR_INSET,
      )}
    >
      {children}
    </nav>
  );
}
