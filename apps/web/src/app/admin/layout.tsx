import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { pageTitle } from '@vendor-marketplace/shared';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { getAdminReviews } from '@/lib/admin-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Admin'),
  // Nothing under `/admin` is public, and none of it should ever be indexed.
  robots: { index: false, follow: false },
};

/** The console reads other people's live accounts; a cached page would moderate a stale one. */
export const dynamic = 'force-dynamic';

/**
 * The operations console.
 *
 * `requireRole('admin')` runs before any child renders and before any read, so
 * a customer or vendor who types `/admin` is bounced to their own home rather
 * than seeing a shell fill with 403s. The API guards every route independently —
 * this is the redirect, not the authorization.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const user = await requireRole('admin');
  /*
   * The badge beside `Reviews`, read as a count rather than through
   * `/admin/metrics`: the metrics route builds four 30-day series, and paying
   * for those on every console page load to render one number would be the
   * expensive way to be correct. `pageSize=1` returns the same `total` the
   * Reviews screen shows.
   */
  const reviews = await getAdminReviews('?pageSize=1');

  return (
    <div data-app-shell className="flex flex-col lg:h-dvh lg:overflow-hidden">
      {/*
        One word, so `initialsFor` yields the single letter the frame draws
        rather than two. The email is the fallback for an account that never
        supplied a name.
      */}
      <AdminHeader email={user.email} name={user.firstName || user.email} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <AdminNav reviewCount={reviews.total} />
        <div className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
