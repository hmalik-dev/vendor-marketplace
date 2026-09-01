import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './data-table';

afterEach(cleanup);

interface Row {
  id: string;
  name: string;
  note: string;
}

const columns: readonly DataTableColumn<Row>[] = [
  { key: 'select', width: '22px', header: '', cell: () => null },
  { key: 'name', width: '1.6fr', header: 'Name', cell: (row) => row.name },
  { key: 'note', width: '.9fr', header: 'Note', cell: (row) => row.note },
  { key: 'overflow', width: '70px', header: '', cell: () => null },
];

/*
 * The row that used to break the table: a cell whose text is far wider than its
 * track. A bare `<flex>` track's automatic minimum is `min-content`, so that
 * cell widened its own track — and because `DataTable` gives the header and
 * every body row their own grid container, only *that* row's widths moved. On
 * `/admin/reviews` 13 of 15 rows disagreed with the header and the trailing
 * action column was pushed to `right=1454` in a 1440 viewport.
 */
const LONG =
  'An unbroken review body that runs far past its track and would size the column itself';

/*
 * **What this file can and cannot settle.** jsdom performs no layout, so
 * `getComputedStyle(row).gridTemplateColumns` never resolves to real widths
 * here and the rendered equality the ticket asks for is *not* verified by these
 * tests — the browser pass owns it, measured on all six admin tables at 1440 /
 * 1024 / 768 / 390. What is verifiable here is the class-level fact underneath
 * it, and it is the whole mechanism: there is exactly **one** template, every
 * row resolves against it, and no track in it can be sized by its own content.
 * A row cannot disagree with the header about a value neither of them owns.
 *
 * Said out loud because `.claude/rules/web-design-parity.md` requires it — a
 * check that cannot fail is not a check, and an earlier draft of this file had
 * one: it compared three rows' templates, but `closest()` resolved all three to
 * the same wrapper node, so it compared a string to itself and passed against
 * the unfixed source.
 */
function renderTable(rows: readonly Row[]) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={<p>Nothing here</p>}
    />,
  );
}

function templateOf(table: HTMLElement): string {
  return table.style.getPropertyValue('--admin-table-columns').trim();
}

describe('DataTable column tracks', () => {
  it('gives every flexible track a zero minimum, so content cannot size it', () => {
    renderTable([{ id: 'a', name: 'Casa Verde', note: LONG }]);

    expect(templateOf(screen.getByRole('table'))).toBe(
      '22px minmax(0, 1.6fr) minmax(0, .9fr) 70px',
    );
  });

  it('leaves fixed tracks exactly as the column declares them', () => {
    renderTable([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    const template = templateOf(screen.getByRole('table'));
    expect(template.startsWith('22px ')).toBe(true);
    expect(template.endsWith(' 70px')).toBe(true);
  });

  it('leaves no bare flex track for a row to resize, however long its text', () => {
    renderTable([
      { id: 'a', name: 'Casa Verde', note: 'Short' },
      { id: 'b', name: LONG, note: LONG },
    ]);

    const bare = templateOf(screen.getByRole('table'))
      .split(' ')
      .filter((track) => /^\d*\.?\d+fr$/.test(track));

    expect(bare).toEqual([]);
  });

  it('resolves the header and every body row against that one template', () => {
    renderTable([
      { id: 'a', name: 'Casa Verde', note: 'Short' },
      { id: 'b', name: LONG, note: LONG },
    ]);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);

    /*
     * The custom property is set once, on the `role="table"` wrapper. Each row
     * reads it through `grid-cols-(--admin-table-columns)` and declares no
     * template of its own — which is what makes the rows incapable of
     * disagreeing. A row that grew its own inline template, or dropped the
     * class, is the shape of the regression this asserts against.
     */
    for (const row of rows) {
      expect(row.className).toContain('grid-cols-(--admin-table-columns)');
      expect(row.style.getPropertyValue('--admin-table-columns')).toBe('');
    }

    expect(screen.getByRole('table').style.getPropertyValue('--admin-table-columns')).not.toBe('');
  });

  /*
   * Flooring the flexible tracks took away the `min-content` floor the header
   * had been leaning on without anyone noticing, and five of six labels on
   * `/admin/reviews` at 390 then overprinted the next one. Every cell in the
   * table — header and body alike — has to be able to elide, or the label wins
   * the space back by overflowing instead of by widening its track.
   */
  it('lets a header label elide rather than overprint its neighbour', () => {
    renderTable([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    for (const cell of screen.getAllByRole('columnheader')) {
      expect(cell.className).toContain('truncate');
    }
  });

  it('keeps a header cell’s own overrides alongside the truncation', () => {
    const withOverride: readonly DataTableColumn<Row>[] = [
      {
        key: 'total',
        width: '1fr',
        header: 'Total',
        headerClassName: 'text-right',
        cell: () => null,
      },
    ];

    render(
      <DataTable
        columns={withOverride}
        rows={[{ id: 'a', name: 'Casa Verde', note: 'Short' }]}
        rowKey={(row) => row.id}
        empty={<p>Nothing here</p>}
      />,
    );

    const [header] = screen.getAllByRole('columnheader');
    expect(header?.className).toContain('truncate');
    expect(header?.className).toContain('text-right');
  });
});
