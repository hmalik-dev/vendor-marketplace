import { AdminSurface } from '@/components/admin/admin-surface';
import { OperatorsPanel } from '@/components/admin/operators-panel';
import { getAdminOperators } from '@/lib/admin-data';

/**
 * Operator access (VEN-506): who can sign in to the console, and the grant and
 * revoke controls that replace a database change once the platform is live.
 *
 * Deliberately unframed, like Settings: no frame draws it, so it follows the
 * console's surface rather than inventing a layout.
 */
export default async function AdminOperatorsPage(): Promise<React.ReactElement> {
  const { items } = await getAdminOperators();
  const active = items.filter((operator) => !operator.isBanned).length;

  return (
    <AdminSurface heading="Operators" counts={[`${active} of ${items.length} able to sign in`]}>
      <div className="h-full min-h-0 overflow-y-auto pb-2">
        <OperatorsPanel operators={items} />
      </div>
    </AdminSurface>
  );
}
