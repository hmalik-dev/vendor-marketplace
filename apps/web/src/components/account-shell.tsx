import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BookingsSidebar, type BookingsSidebarProps } from '@/components/bookings/bookings-sidebar';
import { BookingsSidebarWithCount } from '@/components/bookings/bookings-sidebar-with-count';

export interface AccountShellProps {
  /** The customer's sidebar entry for this page, or `null` for a role that has no sidebar. */
  current: BookingsSidebarProps['current'] | null;
  children: ReactNode;
}

/**
 * The viewport-tall frame `/bookings` and `/messages` draw their screens in
 * (VEN-745): the page never scrolls, and each screen's root is `h-full` inside.
 *
 * A customer gets frame `07`'s sidebar beside the screen. Everyone else — the
 * vendor's inbox — gets the same frame with no nav. The count streams in behind
 * a fallback that draws the nav without one, so it never holds the route's own
 * loading skeleton back.
 */
export function AccountShell({ current, children }: AccountShellProps): React.ReactElement {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      {current === null ? null : (
        <Suspense fallback={<BookingsSidebar bookingCount={null} current={current} />}>
          <BookingsSidebarWithCount current={current} />
        </Suspense>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
