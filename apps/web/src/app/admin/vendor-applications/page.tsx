import { AdminSurface } from '@/components/admin/admin-surface';
import { VendorApplicationsPanel } from '@/components/admin/vendor-applications-panel';
import {
  getAdminPlatformSettings,
  getAdminVendorApplications,
  getAdminVendorInvites,
} from '@/lib/admin-data';

/**
 * The vendor gate's waitlist and invites (VEN-406).
 *
 * Deliberately unframed, like `/admin/settings` where the gate is switched: it
 * follows the console's surface (heading, count line, content pane).
 */
export default async function AdminVendorApplicationsPage(): Promise<React.ReactElement> {
  const [applications, invites, settings] = await Promise.all([
    getAdminVendorApplications(),
    getAdminVendorInvites(),
    getAdminPlatformSettings(),
  ]);
  const waiting = applications.items.filter((application) => application.status === 'new').length;

  return (
    <AdminSurface
      heading="Vendor applications"
      counts={[
        `${waiting} waiting`,
        `${invites.items.length} ${invites.items.length === 1 ? 'invite' : 'invites'}`,
        settings.vendorInviteOnly ? 'Vendors join by invitation' : 'Vendor sign-up is open',
      ]}
    >
      <VendorApplicationsPanel applications={applications.items} invites={invites.items} />
    </AdminSurface>
  );
}
