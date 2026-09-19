import { AdminSurface } from '@/components/admin/admin-surface';
import { adminQueryString, pageNumber, type RawParam } from '@/lib/admin-params';
import { VendorApplicationsPanel } from '@/components/admin/vendor-applications-panel';
import {
  getAdminPlatformSettings,
  getAdminVendorApplications,
  getAdminVendorInvites,
} from '@/lib/admin-data';

const PATH = '/admin/vendor-applications';

/**
 * The vendor gate's waitlist and invites (VEN-406).
 *
 * Deliberately unframed, like `/admin/settings` where the gate is switched: it
 * follows the console's surface (heading, count line, content pane).
 */
export default async function AdminVendorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: RawParam; invitePage?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const applicationsPage = pageNumber(raw.page);
  const invitesPage = pageNumber(raw.invitePage);
  const [applications, invites, settings] = await Promise.all([
    getAdminVendorApplications(adminQueryString({ page: applicationsPage })),
    getAdminVendorInvites(adminQueryString({ page: invitesPage })),
    getAdminPlatformSettings(),
  ]);

  return (
    <AdminSurface
      heading="Vendor applications"
      pager={{
        path: PATH,
        params: { invitePage: invitesPage > 1 ? String(invitesPage) : undefined },
        page: applications.page,
        pageSize: applications.pageSize,
        total: applications.total,
      }}
      counts={[
        `${applications.waiting} waiting`,
        `${invites.total} ${invites.total === 1 ? 'invite' : 'invites'}`,
        settings.vendorInviteOnly ? 'Vendors join by invitation' : 'Vendor sign-up is open',
      ]}
    >
      <VendorApplicationsPanel
        applications={applications.items}
        invites={invites.items}
        invitesPager={{
          path: PATH,
          params: { page: applicationsPage > 1 ? String(applicationsPage) : undefined },
          page: invites.page,
          pageSize: invites.pageSize,
          total: invites.total,
          pageParam: 'invitePage',
        }}
      />
    </AdminSurface>
  );
}
