import { MAX_PAGE_SIZE, toDateString, type AdminExport } from '@vendor-marketplace/shared';
import type { NextRequest } from 'next/server';
import { recordAdminExport } from '@/lib/admin-data';
import { ApiClientError } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/current-user';
import { isTermsRequired, termsAcceptancePath } from '@/lib/terms-gate';

/**
 * The console's `Export CSV` handlers, shared by every list that draws one
 * (VEN-388). `/admin/vendors` had the only one; `/admin/activity` and
 * `/admin/cases` draw it too, and the quoting and the role check are the two
 * halves that must not be written out three times.
 */

/** How many pages an export will walk before it stops asking. */
const MAX_PAGES = 50;

/**
 * RFC 4180 quoting on every field, unconditionally.
 *
 * Quoting only the fields that "need" it is how a business name with a comma in
 * it shifts every column after it by one — and a spreadsheet does not complain,
 * it just shows the wrong city. A leading `=`, `+`, `-` or `@` is additionally
 * prefixed with a tab, because a spreadsheet reads those as a formula: these
 * are files of user-supplied text, and CSV injection is the one way an export
 * of untrusted text becomes code on the operator's machine.
 */
export function csvField(value: string | number | null): string {
  const raw = value === null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `\t${raw}` : raw;

  return `"${safe.replaceAll('"', '""')}"`;
}

/** `request.nextUrl.searchParams` as the `RawParam` record the boundary helpers take. */
export function rawSearchParams(request: NextRequest): Record<string, string[]> {
  /*
   * `getAll`, not `Object.fromEntries` — which keeps the **last** value of a
   * repeated key while `admin-params`' `first()` keeps the first. `?status=review
   * &status=live` would have exported a different set from the table it claims
   * to be exporting.
   */
  return Object.fromEntries(
    [...request.nextUrl.searchParams.keys()].map((key) => [
      key,
      request.nextUrl.searchParams.getAll(key),
    ]),
  );
}

/**
 * The refusal for anyone but a signed-in admin, or `null` to proceed.
 *
 * **A route handler authorizes itself.** A layout does not run for one, so
 * `/admin/layout.tsx`'s `requireRole('admin')` never sees this request — leaving
 * it out would make the admin URLs that return bulk data the ones that are not
 * role-gated.
 */
export async function refuseUnlessAdmin(request: NextRequest): Promise<Response | null> {
  /*
   * `getCurrentUser` propagates a 403, which for a **suspended** operator is an
   * unhandled render error rather than an answer. The pages avoid that by going
   * through `requireCurrentUser`; a route handler has no redirect to offer, so
   * it catches and states the refusal.
   */
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch (error) {
    /*
     * Two different 403s since #429. An operator held at the acceptance gate is
     * one tick from usable and has somewhere to go, so this link takes them
     * there — a download is a navigation, and the browser follows it. A
     * suspended operator gets a refusal rather than a redirect: this is a
     * bulk-data URL.
     */
    if (isTermsRequired(error)) {
      return Response.redirect(
        new URL(termsAcceptancePath(request.nextUrl.pathname), request.nextUrl.origin),
        303,
      );
    }

    if (error instanceof ApiClientError && error.statusCode === 403) {
      return new Response('Forbidden', { status: 403 });
    }

    throw error;
  }

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}

export interface CsvExport<T> {
  /** File name stem — `vendors` becomes `vendors-2026-09-15.csv` — and the audited export. */
  name: AdminExport;
  columns: readonly string[];
  /** The narrowed filters, as a query string with its `?` (from `adminQueryString`). */
  query: string;
  readPage: (query: string) => Promise<{ items: readonly T[]; total: number }>;
  row: (item: T) => readonly (string | number | null)[];
}

/**
 * The whole filtered set, not the page on screen.
 *
 * Exporting only the visible page would be the surprising half of a control
 * that looks like it exports the table. The filters travel with it, so what
 * comes out is exactly what the operator was looking at.
 */
export async function csvExport<T>({
  name,
  columns,
  query,
  readPage,
  row,
}: CsvExport<T>): Promise<Response> {
  const filters = new URLSearchParams(query.slice(1));
  filters.set('pageSize', String(MAX_PAGE_SIZE));

  const lines: string[] = [columns.map((column) => csvField(column)).join(',')];
  let page = 1;
  let total = 0;
  let firstTotal: number | null = null;
  let changedDuringWalk = false;

  do {
    filters.set('page', String(page));
    const result = await readPage(`?${filters.toString()}`);
    total = result.total;
    /*
     * The walk is offset paging over live data, so a colleague resolving a case
     * mid-export shifts every later offset: a row is skipped or repeated. The
     * total is re-read on each page, and the only place that shows is here — by
     * the end it equals the number of lines written and the truncation check
     * below cannot fire.
     */
    changedDuringWalk ||= firstTotal !== null && total !== firstTotal;
    firstTotal ??= total;

    for (const item of result.items) {
      lines.push(row(item).map(csvField).join(','));
    }

    page += 1;
  } while ((page - 1) * MAX_PAGE_SIZE < total && page <= MAX_PAGES);

  const rowCount = lines.length - 1;

  /*
   * Say so when the walk stopped short. A file that quietly ends at 5,000 rows
   * is worse than one that says where it stopped — an operator reconciling
   * numbers would have no way to tell.
   */
  if (lines.length - 1 < total) {
    lines.push(
      csvField(
        `Truncated at ${lines.length - 1} of ${total} rows — narrow the filters to export the rest.`,
      ),
    );
  }

  if (changedDuringWalk) {
    lines.push(
      csvField(
        `The rows changed while this file was being exported (${firstTotal} at the start, ${total} at the end), so it may be incomplete or repeat a row — export again to confirm.`,
      ),
    );
  }

  /*
   * Logged before the file leaves (VEN-475): the API writes the row, and a
   * failure here throws, so no CSV is handed over unrecorded.
   */
  await recordAdminExport({ export: name, filters: query, rowCount });

  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-${toDateString(new Date())}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
