import type { AdminExportAudit } from '@vendor-marketplace/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
import { getServerSession } from '@/lib/auth/server';

/**
 * Tells the API an export was produced (VEN-475). Throws when it cannot, so the
 * handler withholds the file: an export nobody logged did not happen.
 *
 * Its own module rather than an `admin-data` read: the route handler that calls
 * it has already refused anyone but an admin (`refuseUnlessAdmin`), and every
 * `admin-data` export is pinned to go through `adminRead`'s page-side role check.
 */
export async function recordAdminExport(audit: AdminExportAudit): Promise<void> {
  const token = (await getServerSession())?.token ?? null;

  if (!token) {
    throw new Error('No session to record the export under');
  }

  await apiRequest('/admin/exports', {
    method: 'POST',
    // A label, not a key: a percent-encoded search can outgrow the API's bound.
    body: { ...audit, filters: audit.filters.slice(0, 500) },
    schema: z.object({ recorded: z.literal(true) }),
    token,
  });
}
