import { toDateString } from '@vendor-marketplace/shared';
import type { NextRequest } from 'next/server';
import { getAdminCases } from '@/lib/admin-data';
import { csvExport, rawSearchParams, refuseUnlessAdmin } from '@/lib/admin-export';
import { caseParams } from '@/lib/admin-list-params';
import { adminQueryString } from '@/lib/admin-params';
import { CASE_PRESENTATION, caseSubject } from '@/lib/case-presentation';

/** Reads the live queue; never cached. */
export const dynamic = 'force-dynamic';

/**
 * `/admin/cases`' `Export CSV` (VEN-388): every case the filters select,
 * oldest first like the queue, narrowed exactly as the page narrows them.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);

  if (refused) {
    return refused;
  }

  return csvExport({
    name: 'cases',
    columns: ['Reference', 'Sender', 'Sender email', 'Subject', 'Booking id', 'Status', 'Filed'],
    query: adminQueryString(caseParams(rawSearchParams(request))),
    readPage: getAdminCases,
    row: (row) => [
      row.reference,
      row.senderName,
      row.senderEmail,
      caseSubject(row),
      row.bookingId,
      CASE_PRESENTATION[row.status].label,
      toDateString(row.createdAt),
    ],
  });
}
