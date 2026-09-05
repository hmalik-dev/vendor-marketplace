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
function renderTable(rows: readonly Row[], spec: readonly DataTableColumn<Row>[] = columns) {
  return render(
    <DataTable columns={spec} rows={rows} rowKey={(row) => row.id} empty={<p>Nothing here</p>} />,
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

/*
 * `30-responsive.md:31` gives Admin two adaptations and the app had neither:
 * **768 → horizontal scroll** and **390 → card list, not a table**. Measured on
 * 2026-09-05, before this change, `/admin/reviews` at 390x844 resolved to
 * `12.2 31.73 31.73 21.97 46.38 21.97 70` — headers rendering `R…`, `A…`, `W…`.
 * A 12px column cannot show more than an ellipsis.
 *
 * As with the tracks above, jsdom settles the **class- and style-level facts**
 * and not the rendered geometry: `minWidth` is read back as the string the
 * component wrote, and the two branches are identified by the breakpoint
 * classes that gate them, not by which one a layout engine painted. The widths
 * either side of the breakpoint are measured in the browser pass.
 */
describe('DataTable below the desktop widths', () => {
  /*
   * The module fixture with real controls in the two labelless columns, and
   * `font-mono` on a value — the card has to carry a control into its own row
   * and a column's typography onto the value, and `() => null` proves neither.
   */
  const withControls: readonly DataTableColumn<Row>[] = columns.map((column) => {
    if (column.key === 'select') {
      return { ...column, cell: () => <input type="checkbox" /> };
    }
    if (column.key === 'overflow') {
      return { ...column, cell: () => <button type="button">More</button> };
    }
    if (column.key === 'note') {
      return { ...column, className: 'font-mono' };
    }
    return column;
  });

  function renderCards(rows: readonly Row[]) {
    return renderTable(rows, withControls);
  }

  /** The two labelless columns in the fixture — the control columns. */
  function isControlKey(key: string): boolean {
    return key === 'select' || key === 'overflow';
  }

  function cardsOf(): HTMLElement[] {
    return screen.getAllByRole('listitem');
  }

  function fieldsOf(card: Element | undefined, selector: 'dt' | 'dd'): (string | null)[] {
    return [...(card?.querySelectorAll(selector) ?? [])].map((node) => node.textContent);
  }

  it('floors the grid at the width the table resolves to on a small laptop', () => {
    renderTable([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    const table = screen.getByRole('table');
    expect(table.style.getPropertyValue('--admin-table-min-width')).toBe('max(100%, 739px)');
    /*
     * And only below `lg`. At 1024 the floor equals the pane's width — but only
     * where the vertical scrollbar is an overlay; a classic 15px one takes that
     * width out of the content box and the floor would put a horizontal
     * scrollbar on the width frame `13` draws without one.
     */
    expect(table.className).toContain('max-lg:min-w-(--admin-table-min-width)');
    expect(table.className).toContain('min-w-full');
  });

  it('scrolls that overflow inside the pane, never the document', () => {
    renderTable([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    // Both axes, explicitly: the floor is what makes horizontal overflow
    // reachable, and it has to land here rather than on the document (#389).
    expect(screen.getByRole('table').parentElement?.className).toContain('overflow-auto');
  });

  /*
   * The regression this closes: `column.className` is the **body cell's**
   * override bucket and it carries table geometry as well as typography —
   * `flex justify-end overflow-visible` on a 70px track. Applied to the card's
   * control wrapper it fought the `flex-1` basis that gives `w-full` something
   * to resolve against, and the reviews delete button came out 4px wide.
   */
  it('positions the card’s controls itself rather than from the table’s cell classes', () => {
    const geometry: readonly DataTableColumn<Row>[] = withControls.map((column) =>
      isControlKey(column.key)
        ? { ...column, className: 'flex justify-end overflow-visible' }
        : column,
    );
    renderTable([{ id: 'a', name: 'Casa Verde', note: 'Short' }], geometry);

    const wrappers = [...(cardsOf()[0]?.querySelectorAll(':scope > div > div') ?? [])];
    expect(wrappers).toHaveLength(2);
    // First control at the start of the row, last at its end — where the table
    // puts them — and the cell's own geometry classes nowhere in sight.
    expect(wrappers[0]?.className).toBe('flex shrink-0 items-center justify-end');
    expect(wrappers[1]?.className).toBe('flex shrink-0 items-center justify-end ml-auto');
  });

  /*
   * Each control keeps its declared track, floored at `04-laws.md`'s 44px. An
   * equal share of the row instead made the reviews card's lone control a 308px
   * button over what reads as padding, and a tap there opened a destructive
   * dialog; no width at all collapsed it to 4px, because `RowTrigger` fills its
   * cell with `w-full` and a percentage against a shrink-to-fit item resolves
   * against that item's own content.
   */
  it('sizes each card control to its column, never under the 44px target', () => {
    renderCards([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    const wrappers = [
      ...((cardsOf()[0]?.querySelectorAll(':scope > div > div') ?? []) as NodeListOf<HTMLElement>),
    ];
    /*
     * Read as a number rather than as the string the component wrote: jsdom
     * folds `max(44px, 22px)` to `calc(44px)`, and the number is the fact. The
     * 22px select track is the frame's desktop geometry and does not carry
     * over; the 70px overflow track does, because it already clears the law.
     */
    const widthOf = (wrapper: HTMLElement | undefined): number =>
      Number(/([\d.]+)px/.exec(wrapper?.style.width ?? '')?.[1] ?? Number.NaN);

    expect(widthOf(wrappers[0])).toBe(44);
    expect(widthOf(wrappers[1])).toBe(70);
  });

  it('renders the table from 768 up and the card list below it, never both', () => {
    renderCards([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    const table = screen.getByRole('table');
    expect(table.className).toContain('hidden');
    expect(table.className).toContain('md:block');
    expect(screen.getByRole('list').className).toContain('md:hidden');
  });

  it('gives every labelled column its header as the card’s own label', () => {
    renderCards([
      { id: 'a', name: 'Casa Verde', note: 'Short' },
      { id: 'b', name: 'Rua Nova', note: LONG },
    ]);

    const cards = cardsOf();
    expect(cards).toHaveLength(2);

    expect(fieldsOf(cards[0], 'dt')).toEqual(['Name', 'Note']);
    expect(fieldsOf(cards[0], 'dd')).toEqual(['Casa Verde', 'Short']);
    expect(fieldsOf(cards[1], 'dd')).toEqual(['Rua Nova', LONG]);
  });

  it('lets a card value wrap, because there is nothing beside it to scroll to', () => {
    renderCards([{ id: 'b', name: 'Rua Nova', note: LONG }]);

    const values = [...(cardsOf()[0]?.querySelectorAll('dd') ?? [])];
    expect(values[0]?.className).toContain('break-words');
    expect(values[0]?.className).not.toContain('whitespace-nowrap');
    // The column's own typography still applies — `font-mono` on a total, the
    // business name's weight. Only the truncation is dropped.
    expect(values[1]?.className).toContain('font-mono');
  });

  it('carries a control column into the card without an empty label beside it', () => {
    renderCards([{ id: 'a', name: 'Casa Verde', note: 'Short' }]);

    const [card] = cardsOf();
    // Two labelled columns, two labels — the checkbox and the overflow are neither.
    expect(card?.querySelectorAll('dt')).toHaveLength(2);
    expect(card?.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(card?.querySelector('button')?.textContent).toBe('More');
  });

  it('shows the empty state once, not once per branch', () => {
    renderCards([]);

    expect(screen.getAllByText('Nothing here')).toHaveLength(1);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
