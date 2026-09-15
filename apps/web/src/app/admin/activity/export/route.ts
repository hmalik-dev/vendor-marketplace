import type { NextRequest } from 'next/server';
import { ACTION_LABELS, detailLine, SUBJECT_LABELS } from '@/components/admin/activity-table';
import { getAdminActivity } from '@/lib/admin-data';
import { csvExport, rawSearchParams, refuseUnlessAdmin } from '@/lib/admin-export';
import { activityParams } from '@/lib/admin-list-params';
import { adminQueryString } from '@/lib/admin-params';

/** Reads the live log; never cached. */
export const dynamic = 'force-dynamic';

/**
 * `/admin/activity`'s `Export CSV` (VEN-388): every row the filters select,
 * narrowed exactly as the page narrows them.
 *
 * `When` is the ISO instant rather than the table's formatted stamp — a file is
 * read by a spreadsheet, and an unambiguous UTC value sorts and parses there.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const refused = await refuseUnlessAdmin(request);

  if (refused) {
    return refused;
  }

  return csvExport({
    name: 'activity',
    columns: ['When (UTC)', 'Actor', 'Action', 'Subject type', 'Subject id', 'What changed'],
    query: adminQueryString(activityParams(rawSearchParams(request))),
    readPage: getAdminActivity,
    row: (row) => [
      row.createdAt.toISOString(),
      row.actorName,
      ACTION_LABELS[row.action],
      SUBJECT_LABELS[row.subjectType],
      row.subjectId,
      detailLine(row.detail),
    ],
  });
}
