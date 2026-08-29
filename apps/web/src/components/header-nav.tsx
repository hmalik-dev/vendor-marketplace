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

const BASE = 'flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10';

export interface HeaderNavProps {
  children: React.ReactNode;
}

export function HeaderNav({ children }: HeaderNavProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={cn(BASE, pathname === '/search' && SEARCH_INSET)}>
      {children}
    </nav>
  );
}
