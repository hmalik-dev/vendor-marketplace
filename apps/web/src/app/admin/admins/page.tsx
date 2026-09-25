import { AdminSurface } from '@/components/admin/admin-surface';
import { AdminsPanel } from '@/components/admin/admins-panel';
import { getAdminAccounts } from '@/lib/admin-data';

/**
 * Admin access (VEN-506): who can sign in to the console, and the grant and
 * revoke controls that replace a database change once the platform is live.
 *
 * Frame `64 Admin access` draws it; like Settings, it follows the
 * console's surface rather than inventing a layout.
 */
export default async function AdminAccountsPage(): Promise<React.ReactElement> {
  const { items } = await getAdminAccounts();
  const active = items.filter((admin) => !admin.isBanned).length;

  return (
    <AdminSurface heading="Admins" counts={[`${active} of ${items.length} able to sign in`]}>
      <div className="h-full min-h-0 overflow-y-auto pb-2">
        <AdminsPanel admins={items} />
      </div>
    </AdminSurface>
  );
}
