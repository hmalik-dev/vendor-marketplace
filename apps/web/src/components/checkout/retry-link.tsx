'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';

/**
 * A link whose destination is the page the reader is already on, so following
 * it must **re-render** that page rather than navigate to it.
 *
 * A `<Link>` to the current URL is answered from the router cache when the page
 * was itself reached by a client navigation moments ago (the Pay link opts out
 * of prefetch, VEN-715, so its click leaves exactly such an entry), and the
 * server never runs again: the checkout retry sat on the paused screen after
 * the admin had lifted the pause, which is the one thing it exists to do.
 * `router.refresh()` drops that cache and re-renders the route on the server,
 * and the anchor keeps its `href`, so a new-tab click, a long press and a
 * browser with no script still reach the same page.
 */
export function RetryLink({
  href,
  onClick,
  ...rest
}: ComponentProps<typeof Link>): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();

  const refresh = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);

    const plainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (plainClick && !event.defaultPrevented && href === pathname) {
      event.preventDefault();
      router.refresh();
    }
  };

  return <Link href={href} onClick={refresh} {...rest} />;
}
