import { MAX_PAGE_SIZE } from '@vendor-marketplace/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/admin-data', () => ({ recordAdminExport: vi.fn() }));

import { recordAdminExport } from '@/lib/admin-data';

import { csvExport, csvField } from './admin-export';
import { activityParams, caseParams } from './admin-list-params';
import { adminQueryString } from './admin-params';

/*
 * The shared `Export CSV` walk (VEN-388). `/admin/vendors` had the only one;
 * `/admin/activity` and `/admin/cases` now go through the same function, so
 * what is asserted here holds for all three files an operator can download.
 */
describe('csvExport', () => {
  it('walks every page under the page’s own filters and quotes every field', async () => {
    const rows = Array.from({ length: MAX_PAGE_SIZE + 1 }, (_, index) => `row ${index}`);
    const readPage = vi.fn(async (query: string) => {
      const page = Number(new URLSearchParams(query.slice(1)).get('page'));

      return {
        items: rows.slice((page - 1) * MAX_PAGE_SIZE, page * MAX_PAGE_SIZE),
        total: rows.length,
      };
    });

    const response = await csvExport({
      name: 'cases',
      columns: ['Reference'],
      query: adminQueryString(caseParams({ q: 'kessler', status: 'resolved' })),
      readPage,
      row: (row) => [row],
    });
    const lines = (await response.text()).trimEnd().split('\r\n');

    expect(readPage.mock.calls.map(([query]) => query)).toEqual([
      `?q=kessler&status=resolved&pageSize=${MAX_PAGE_SIZE}&page=1`,
      `?q=kessler&status=resolved&pageSize=${MAX_PAGE_SIZE}&page=2`,
    ]);
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[0]).toBe('"Reference"');
    expect(lines.at(-1)).toBe(`"row ${MAX_PAGE_SIZE}"`);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="cases-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  it('ends with a line saying so when the set changed between pages', async () => {
    const rows = Array.from({ length: MAX_PAGE_SIZE + 1 }, (_, index) => `row ${index}`);
    let reads = 0;
    // A row is resolved after page 1 is read: the total shrinks by one and the
    // next offset skips the row that slid into page 1's range.
    const readPage = vi.fn(async (query: string) => {
      const page = Number(new URLSearchParams(query.slice(1)).get('page'));
      reads += 1;
      const live = reads === 1 ? rows : rows.slice(1);

      return {
        items: live.slice((page - 1) * MAX_PAGE_SIZE, page * MAX_PAGE_SIZE),
        total: live.length,
      };
    });

    const response = await csvExport({
      name: 'cases',
      columns: ['Reference'],
      query: '',
      readPage,
      row: (row) => [row],
    });
    const lines = (await response.text()).trimEnd().split('\r\n');

    expect(lines.at(-1)).toBe(
      `"The rows changed while this file was being exported (${MAX_PAGE_SIZE + 1} at the start, ${MAX_PAGE_SIZE} at the end), so it may be incomplete or repeat a row — export again to confirm."`,
    );
  });

  it('adds no note when the set held still', async () => {
    const response = await csvExport({
      name: 'cases',
      columns: ['Reference'],
      query: '',
      readPage: async () => ({ items: ['a', 'b'], total: 2 }),
      row: (row) => [row],
    });

    expect((await response.text()).trimEnd().split('\r\n')).toEqual(['"Reference"', '"a"', '"b"']);
  });

  it.each(['vendors', 'activity', 'cases'] as const)(
    'reports the %s export and its row count before handing the file over',
    async (name) => {
      vi.mocked(recordAdminExport).mockClear();

      await csvExport({
        name,
        columns: ['Reference'],
        query: '?status=live',
        readPage: async () => ({ items: ['a', 'b'], total: 2 }),
        row: (row) => [row],
      });

      expect(recordAdminExport).toHaveBeenCalledExactlyOnceWith({
        export: name,
        filters: '?status=live',
        rowCount: 2,
      });
    },
  );

  it('withholds the file when the export cannot be recorded', async () => {
    vi.mocked(recordAdminExport).mockRejectedValueOnce(new Error('audit down'));

    await expect(
      csvExport({
        name: 'vendors',
        columns: ['Reference'],
        query: '',
        readPage: async () => ({ items: ['a'], total: 1 }),
        row: (row) => [row],
      }),
    ).rejects.toThrow('audit down');
  });

  it('neutralises a formula and doubles an embedded quote', () => {
    expect(csvField('=HYPERLINK("x")')).toBe('"\t=HYPERLINK(""x"")"');
    expect(csvField(null)).toBe('""');
  });
});

describe('the list filters an export narrows by', () => {
  it('drops what the page would drop, so the file matches the table', () => {
    expect(
      activityParams({
        actor: 'not-a-uuid',
        subjectType: ['review', 'user'],
        range: '90d',
        action: 'user_banned',
      }),
    ).toEqual({
      actor: undefined,
      subjectType: 'review',
      range: undefined,
      action: 'user_banned',
      subject: undefined,
    });
    expect(caseParams({ q: '  ORL-4K7Q  ', status: 'closed', booking: 'with' })).toEqual({
      q: 'ORL-4K7Q',
      status: undefined,
      booking: 'with',
    });
  });
});
