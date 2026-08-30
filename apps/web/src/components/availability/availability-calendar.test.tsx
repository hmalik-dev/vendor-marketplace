import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WireAvailability } from '@/lib/wire-schemas';

const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { AvailabilityCalendar, cellAppearance, formatRange } =
  await import('./availability-calendar');

/*
 * A fixed "today" keeps the grid deterministic. 2026-06-01 is a Monday, so June
 * lays out predictably and June/July/August are the three visible months.
 */
const TODAY = '2026-06-01';

/*
 * `isFutureDate` reads the real clock to decide what is editable, so the clock
 * is pinned to the same day the grid is built from. Without this the suite
 * passes in May and fails in July.
 */
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterAll(() => {
  vi.useRealTimers();
});

function entry(date: string, status: WireAvailability['status']): WireAvailability {
  return { date, status } as WireAvailability;
}

function renderCalendar(entries: readonly WireAvailability[] = []) {
  return render(<AvailabilityCalendar initialEntries={entries} today={TODAY} />);
}

/** The value beside a "This quarter" row label. */
function quarterCount(label: string): string {
  const quarter = screen.getByRole('heading', { name: 'This quarter' }).parentElement;
  const term = within(quarter!).getByText(label);
  return term.nextElementSibling?.textContent?.trim() ?? '';
}

/** The day cell for a `YYYY-MM-DD`, found by the date in its accessible name. */
function cell(date: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${date} —`) });
}

describe('formatRange', () => {
  it('renders a single day on its own', () => {
    expect(formatRange(['2026-07-17'])).toBe('Jul 17');
  });

  it('drops the repeated month inside one month', () => {
    expect(formatRange(['2026-07-17', '2026-07-18', '2026-07-19'])).toBe('Jul 17 — 19');
  });

  it('keeps both months when a range crosses a boundary', () => {
    expect(formatRange(['2026-07-30', '2026-07-31', '2026-08-01'])).toBe('Jul 30 — Aug 1');
  });

  it('returns an empty string for an empty selection', () => {
    expect(formatRange([])).toBe('');
  });
});

/*
 * A `hover:` utility outranks a plain one at the same specificity, so layering
 * the selected fill over an available cell's hover fill painted white text on
 * near-white the moment the pointer was over a selected date. Exactly one
 * appearance wins, and this is where that is decided.
 */
describe('cellAppearance', () => {
  /*
   * #279. `toContain` on a class string is not a safe assertion: `bg-clay-400`
   * is a substring of `bg-clay-400/30`, and `bg-clay-50` is a substring of
   * `bg-clay-500` — so a `not.toContain('bg-clay-50')` guard fails the moment
   * an unrelated `bg-clay-500` appears. Every class assertion here is an exact
   * token match against the split string.
   */
  const tokens = (classes: string): string[] => classes.split(/\s+/).filter(Boolean);

  it('lets the selecting fill beat whatever the date currently is', () => {
    for (const status of ['available', 'blocked', 'booked', 'pending'] as const) {
      const classes = tokens(cellAppearance(status, { isPast: false, isSelected: true }));
      expect(classes).toContain('bg-clay-400');
      expect(classes).toContain('text-stone-0');
      expect(classes.some((token) => token.startsWith('hover:'))).toBe(false);
    }
  });

  it('never emits a hover fill alongside the selecting fill', () => {
    const selected = tokens(cellAppearance('available', { isPast: false, isSelected: true }));
    const idle = tokens(cellAppearance('available', { isPast: false, isSelected: false }));

    expect(idle).toContain('hover:bg-clay-50');
    expect(selected).not.toContain('hover:bg-clay-50');
    expect(selected).not.toContain('bg-clay-50');
  });

  it('puts a past date on the inert token and nothing else', () => {
    const classes = tokens(cellAppearance('available', { isPast: true, isSelected: true }));

    expect(classes).toContain('text-stone-500');
    expect(classes).toContain('bg-stone-50');
    expect(classes).not.toContain('bg-clay-400');
  });

  /*
   * A completed event is *defined* by being in the past, so the plain past
   * branch would erase the one state it exists to show. This is the only
   * status that outranks `isPast`, and it is worth its own assertion because
   * getting the branch order wrong looks like nothing at all — the cell simply
   * renders inert and the check never draws.
   */
  it('keeps a completed date sage rather than inert, though it is always past', () => {
    const classes = tokens(cellAppearance('completed', { isPast: true, isSelected: false }));

    expect(classes).toContain('bg-sage-50');
    expect(classes).toContain('text-sage-600');
    expect(classes).not.toContain('text-stone-500');
  });

  /*
   * The point of #166: the fill stopped being the signal. Every state has to
   * be tellable apart with colour removed, so each one carries a shape — and a
   * test on the fill alone would pass on the calendar this replaced.
   */
  it('gives every state a mark that is not its fill', () => {
    const shapes: Record<string, (classes: string[]) => boolean> = {
      // dashed border, drawn on the cell itself
      pending: (c) => c.includes('border-dashed') && c.includes('border-gold-400'),
      // hatch + strike, neither of which is a flat background colour
      blocked: (c) => c.includes('line-through') && c.some((t) => t.startsWith('bg-[repeating')),
    };

    for (const [status, hasShape] of Object.entries(shapes)) {
      const classes = tokens(
        cellAppearance(status as 'pending' | 'blocked', { isPast: false, isSelected: false }),
      );
      expect(hasShape(classes), status).toBe(true);
    }
  });
});

describe('AvailabilityCalendar', () => {
  afterEach(() => {
    cleanup();
    requestMock.mockReset();
  });

  it('shows three months side by side with no month navigation needed', () => {
    renderCalendar();

    for (const month of ['June', 'July', 'August']) {
      expect(screen.getByRole('heading', { name: month })).toBeDefined();
    }
  });

  /*
   * Colour is never the only signal: booked is bold, blocked is struck through,
   * and every cell names its state in its accessible name.
   */
  it('states each date status in the accessible name, not only in colour', () => {
    renderCalendar([
      entry('2026-06-15', 'booked'),
      entry('2026-06-16', 'blocked'),
      entry('2026-06-17', 'pending'),
    ]);

    expect(cell('2026-06-15').getAttribute('aria-label')).toContain('Booked — locked');
    expect(cell('2026-06-16').getAttribute('aria-label')).toContain('Blocked by you');
    expect(cell('2026-06-17').getAttribute('aria-label')).toContain('Pending request');
  });

  it('strikes blocked dates through and bolds booked ones', () => {
    renderCalendar([entry('2026-06-15', 'booked'), entry('2026-06-16', 'blocked')]);

    expect(cell('2026-06-15').className).toContain('font-semibold');
    expect(cell('2026-06-16').className).toContain('line-through');
  });

  it('locks the dates the vendor does not own', () => {
    renderCalendar([entry('2026-06-15', 'booked'), entry('2026-06-17', 'pending')]);

    expect(cell('2026-06-15')).toHaveProperty('disabled', true);
    expect(cell('2026-06-17')).toHaveProperty('disabled', true);
    // An ordinary open date stays editable.
    expect(cell('2026-06-18')).toHaveProperty('disabled', false);
  });

  /*
   * A vendor who wakes up ill blocks *today*. Offering tomorrow while refusing
   * the day they are standing in fails at the one moment the calendar matters
   * most, so the floor is today rather than tomorrow.
   */
  it('leaves today editable', () => {
    renderCalendar();

    const todayCell = cell(TODAY);
    expect(todayCell).toHaveProperty('disabled', false);
    expect(todayCell.getAttribute('aria-label')).not.toContain('in the past');
  });

  /*
   * What has already happened is a record, not a setting: a past cell keeps the
   * status it actually had and is read-only, rather than being blanked.
   */
  it('locks every date before today while keeping the status it had', () => {
    const midMonth = '2026-06-15';
    render(
      <AvailabilityCalendar
        initialEntries={[entry('2026-06-10', 'booked'), entry('2026-06-11', 'blocked')]}
        today={midMonth}
      />,
    );

    for (const [date, label] of [
      ['2026-06-10', 'Booked — locked'],
      ['2026-06-11', 'Blocked by you'],
      ['2026-06-14', 'Available'],
    ]) {
      const past = cell(date);
      expect(past, date).toHaveProperty('disabled', true);
      expect(past.getAttribute('aria-label'), date).toContain('in the past');
      // The historical status survives; the cell is read-only, not emptied.
      expect(past.getAttribute('aria-label'), date).toContain(label);
    }

    expect(cell(midMonth)).toHaveProperty('disabled', false);
  });

  it('selects a single date and offers to block it', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));

    expect(screen.getByText('Jun 18')).toBeDefined();
    expect(screen.getByText(/1 day · currently available/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Block these' })).toBeDefined();
  });

  it('extends a range with shift-click, so a range is reachable from the keyboard', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));
    await user.keyboard('{Shift>}');
    await user.click(cell('2026-06-20'));
    await user.keyboard('{/Shift}');

    expect(screen.getByText('Jun 18 — 20')).toBeDefined();
    expect(screen.getByText(/3 days/)).toBeDefined();
  });

  it('extends a range across a month boundary', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-29'));
    await user.keyboard('{Shift>}');
    await user.click(cell('2026-07-02'));
    await user.keyboard('{/Shift}');

    expect(screen.getByText('Jun 29 — Jul 2')).toBeDefined();
  });

  it('leaves booked dates out of a range that spans them', async () => {
    const user = userEvent.setup();
    renderCalendar([entry('2026-06-19', 'booked')]);

    await user.click(cell('2026-06-18'));
    await user.keyboard('{Shift>}');
    await user.click(cell('2026-06-20'));
    await user.keyboard('{/Shift}');

    // 18, 19, 20 span three days but the booked 19th is not the vendor's to give.
    expect(screen.getByText(/2 days/)).toBeDefined();
  });

  it('offers to reopen a selection that is already blocked', async () => {
    const user = userEvent.setup();
    renderCalendar([entry('2026-06-18', 'blocked')]);

    await user.click(cell('2026-06-18'));

    expect(screen.getByText(/currently blocked/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open these up' })).toBeDefined();
  });

  it('sends only the editable dates to the API when blocking', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue([entry('2026-06-18', 'blocked')]);
    renderCalendar([entry('2026-06-19', 'booked')]);

    await user.click(cell('2026-06-18'));
    await user.keyboard('{Shift>}');
    await user.click(cell('2026-06-20'));
    await user.keyboard('{/Shift}');
    await user.click(screen.getByRole('button', { name: 'Block these' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/vendor/availability',
      expect.objectContaining({
        method: 'PUT',
        body: {
          entries: [
            { date: '2026-06-18', status: 'blocked' },
            { date: '2026-06-20', status: 'blocked' },
          ],
        },
      }),
    );
  });

  it('clears the selection without touching the calendar', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByRole('button', { name: 'Block these' })).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  /*
   * The rail's counts describe the quarter on screen, and they are read from
   * the calendar rather than stored — a derived number is never incremented.
   */
  it('counts the visible quarter and recomputes as dates change', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue([
      entry('2026-06-15', 'booked'),
      entry('2026-06-16', 'blocked'),
      entry('2026-06-18', 'blocked'),
    ]);
    renderCalendar([entry('2026-06-15', 'booked'), entry('2026-06-16', 'blocked')]);

    expect(quarterCount('Blocked')).toBe('1 dates');
    expect(quarterCount('Booked ahead')).toBe('1 dates');

    await user.click(cell('2026-06-18'));
    await user.click(screen.getByRole('button', { name: 'Block these' }));

    // Two blocked dates now; the booked count is untouched.
    expect(quarterCount('Blocked')).toBe('2 dates');
    expect(quarterCount('Booked ahead')).toBe('1 dates');
  });

  /*
   * The end-to-end claim in #307/#212, pinned in one place.
   *
   * The API test asserts that accepting a request makes `GET
   * /vendor/availability` return `status: 'booked'` for that date; this asserts
   * that exactly that payload produces the frame's `Booked — locked` cell and a
   * `Booked` count of one. Without it the two halves meet only in prose, and
   * the accept -> `booked` mapping could regress with every test still green.
   *
   * The entries are written the way the API sends them rather than through the
   * `entry` helper, so a change to the wire shape breaks this too.
   */
  it('turns the API’s accepted-date payload into a locked, counted Booked cell', () => {
    renderCalendar([
      {
        id: crypto.randomUUID(),
        vendorId: 'ven-1',
        date: '2026-06-15',
        status: 'booked',
        note: null,
      },
      {
        id: crypto.randomUUID(),
        vendorId: 'ven-1',
        date: '2026-06-16',
        status: 'pending',
        note: null,
      },
    ] as unknown as WireAvailability[]);

    expect(cell('2026-06-15').getAttribute('aria-label')).toBe('2026-06-15 — Booked — locked');
    expect(cell('2026-06-15')).toHaveProperty('disabled', true);
    expect(quarterCount('Booked ahead')).toBe('1 dates');

    // And the pending sibling is neither counted as booked nor editable.
    expect(cell('2026-06-16').getAttribute('aria-label')).toBe('2026-06-16 — Pending request');
    expect(cell('2026-06-16')).toHaveProperty('disabled', true);
  });

  it('counts only open future Saturdays, since that is the number that drives action', () => {
    // June 2026 Saturdays: 6, 13, 20, 27. Blocking the 13th leaves three.
    renderCalendar([entry('2026-06-13', 'blocked')]);

    const quarter = screen.getByRole('heading', { name: 'This quarter' }).parentElement;
    const openSaturdays = within(quarter!).getByText(/left$/).textContent ?? '';

    expect(Number(openSaturdays.replace(/\D/g, ''))).toBeGreaterThan(0);
  });

  /*
   * #166's acceptance, asserted on the rendered cell rather than on the class
   * string: every state must be tellable apart with colour removed. The dot and
   * the check are their own elements; pending and blocked carry theirs as a
   * border and a strike, which is why this reads two different ways.
   */
  it('draws a shape on every state that the frame gives one', () => {
    renderCalendar([
      entry('2026-06-15', 'booked'),
      entry('2026-06-16', 'blocked'),
      entry('2026-06-17', 'pending'),
      entry('2026-06-02', 'completed'),
    ]);

    // Booked — a dot element under the numeral.
    expect(cell('2026-06-15').querySelector('i')).not.toBeNull();
    // Completed — a check element, and it survives being in the past.
    expect(cell('2026-06-02').querySelector('i')).not.toBeNull();

    // Pending — a dashed border on the cell itself, no child element.
    const pending = cell('2026-06-17').className.split(/\s+/);
    expect(pending).toContain('border-dashed');
    expect(pending).toContain('border-gold-400');
    expect(cell('2026-06-17').querySelector('i')).toBeNull();

    // Blocked — a strike, and a hatch that is not a flat fill.
    const blocked = cell('2026-06-16').className.split(/\s+/);
    expect(blocked).toContain('line-through');
    expect(blocked.some((token) => token.startsWith('bg-[repeating'))).toBe(true);
  });

  /*
   * The completed state only means anything if the counter can reach a real
   * number. It is derived from past booked dates by the API, so the rail row
   * is a query result rather than a figure the UI invented.
   */
  it('counts completed events in the rail, separately from booked ones', () => {
    renderCalendar([
      entry('2026-06-02', 'completed'),
      entry('2026-06-03', 'completed'),
      entry('2026-06-15', 'booked'),
    ]);

    expect(quarterCount('Completed')).toBe('2 events');
    expect(quarterCount('Booked ahead')).toBe('1 dates');
  });

  it('says event rather than events for a single completed date', () => {
    renderCalendar([entry('2026-06-02', 'completed')]);

    expect(quarterCount('Completed')).toBe('1 event');
  });

  it('lists every state in the legend, including the ones it cannot yet produce', () => {
    renderCalendar();

    const legend = screen.getByRole('heading', { name: 'Legend' }).parentElement;
    for (const label of [
      'Available',
      'Booked — locked',
      'Pending request',
      'Blocked by you',
      'Completed',
      'Selecting now',
      'Today',
    ]) {
      expect(within(legend!).getByText(label, { exact: false })).toBeDefined();
    }
  });

  /*
   * #263. A legend of flat colour chips is a key to the one signal this
   * calendar stopped relying on — the redesign's whole point is that state is
   * carried by a SHAPE, so the legend has to show the shape or it explains
   * nothing. Each swatch is the cell it describes.
   */
  it('names the mark beside each state, not just its colour', () => {
    renderCalendar();

    const legend = screen.getByRole('heading', { name: 'Legend' }).parentElement;
    const text = legend?.textContent ?? '';

    expect(text).toContain('Available — no mark');
    expect(text).toContain('Booked — locked · dot');
    expect(text).toContain('Pending request · dashed');
    expect(text).toContain('Blocked by you · hatch + strike');
    expect(text).toContain('Completed · check');
    expect(text).toContain('Today · ink outline');
  });

  it('draws the real mark in the legend swatch, not a flat chip', () => {
    const { container } = renderCalendar();
    const legend = screen.getByRole('heading', { name: 'Legend' }).parentElement;

    // The dot and the check are the two marks that are their own element.
    const marks = legend?.querySelectorAll('i') ?? [];
    expect(marks.length).toBe(2);
    expect(container).toBeDefined();
  });

  /*
   * The design's market note quotes a city-wide booking rate. There is no
   * market data to read that from, so the panel states only this vendor's own
   * numbers — see design/design-plan/98-post-mvp.md.
   */
  it('states no number it cannot read from this vendor own calendar', () => {
    renderCalendar([entry('2026-06-15', 'booked')]);

    expect(document.body.textContent).not.toMatch(/across Austin|%|average|median/i);
  });
});

/*
 * Frame `11 Availability` is the acceptance criterion for this screen. Every
 * expected value below is read out of the frame at test time rather than
 * written down here, so a design re-import that moves one fails this file
 * instead of passing silently.
 *
 * jsdom has no layout, so these compare the utility the component asks for
 * against the value the frame declares. The browser parity gate is the real
 * check; this is what stops the two sides drifting apart in source between
 * gates.
 */
const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

/** Frame `11 Availability`, up to the frame that follows it. */
const FRAME_11 = (() => {
  const start = frames.indexOf('data-screen-label="11 Availability"');
  const next = frames.indexOf('class="fr"', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
})();

/** One `property:value` out of an inline `style` attribute, as the frame writes it. */
function styleValue(markup: string, property: string): string {
  const declaration = new RegExp(`(?:^|[;"])${property}:([^;"]+)`).exec(markup);

  if (!declaration?.[1]) {
    throw new Error(`Frame 11 does not set \`${property}\` on this element`);
  }

  return declaration[1].trim();
}

/*
 * The rail — the frame's 300px right-hand column. The selected panel has to be
 * found inside the rail rather than in the whole frame: the booked day cells
 * carry the same `#F7E7E0` fill (booked *is* clay-100 by design), so a
 * frame-wide search finds a 7px day cell instead of the 12px panel.
 */
const FRAME_11_RAIL = (() => {
  const at = FRAME_11.indexOf('width:300px');

  if (at === -1) {
    throw new Error('Frame 11 no longer draws the 300px rail');
  }

  return FRAME_11.slice(at);
})();

/** The rail's "Selected" panel — the one clay-100 panel the rail draws. */
const frameSelectedPanel = (() => {
  const at = FRAME_11_RAIL.indexOf('background:#F7E7E0;border-radius:');

  if (at === -1) {
    throw new Error('Frame 11 no longer draws the selected panel this test measures');
  }

  return FRAME_11_RAIL.slice(at, FRAME_11_RAIL.indexOf('>', at));
})();

/*
 * The market-note panel at the foot of the rail. `lastIndexOf`, because the
 * rail draws two `#F1ECE4` panels: the designer's note about the shape-first
 * cell states at `border-radius:9px`, then this one last at 12px.
 */
const frameMarketNote = (() => {
  const at = FRAME_11_RAIL.lastIndexOf('background:#F1ECE4');

  if (at === -1) {
    throw new Error('Frame 11 no longer draws the market-note panel this test measures');
  }

  return FRAME_11_RAIL.slice(at, FRAME_11_RAIL.indexOf('>', at));
})();

/** The `<span>` the frame's rail draws for a given label. */
function frameSpanFor(label: string): string {
  const at = FRAME_11_RAIL.indexOf(`>${label}<`);

  if (at === -1) {
    throw new Error(`Frame 11's rail no longer draws \`${label}\``);
  }

  return FRAME_11_RAIL.slice(FRAME_11_RAIL.lastIndexOf('<span', at), at + 1);
}

/*
 * The frame's month-nav glyphs. They sit in the pane, not the rail, and the
 * `‹` span is the first thing the title row draws after the heading.
 */
const frameNavGlyphs = (() => {
  const at = FRAME_11.indexOf('June — August 2026');

  if (at === -1) {
    throw new Error('Frame 11 no longer draws the month range this test measures');
  }

  return FRAME_11.slice(FRAME_11.lastIndexOf('<div', at), FRAME_11.indexOf('</div>', at));
})();

/*
 * The `‹` glyph's own style. It has to be read off the span rather than the row
 * that holds it: the row is `#4A443C` and the glyphs are the muted `#6B6459`,
 * so reading the row silently measures the wrong colour.
 */
const frameNavGlyphStyle = (() => {
  const found = /<span style="([^"]*)">\u2039</.exec(frameNavGlyphs);

  if (!found?.[1]) {
    throw new Error('Frame 11 no longer styles the month-nav glyph this test measures');
  }

  return found[1];
})();

/** The theme token whose value is this hex, e.g. `#6B6459` -> `stone-600`. */
function colourToken(hex: string): string {
  const theme = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );
  const found = new RegExp(`--color-([a-z0-9-]+):\\s*${hex}\\s*;`, 'i').exec(theme);

  if (!found?.[1]) {
    throw new Error(`No theme colour token has the value ${hex}`);
  }

  return found[1];
}

/*
 * The frame's day grid. `[1]`, not `[0]`: each month draws two 7-column grids,
 * the weekday initials first and the day numerals second.
 */
const frameDayGrid = (() => {
  const grids = [...FRAME_11.matchAll(/<div style="([^"]*repeat\(7,1fr\)[^"]*)"/g)];
  const dayGrid = grids[1]?.[1];

  if (!dayGrid) {
    throw new Error('Frame 11 no longer draws the day grid this test measures');
  }

  return dayGrid;
})();

/** The frame's one instruction line, HTML entities resolved. */
const frameInstruction = (() => {
  const at = FRAME_11.indexOf('Click a date');

  if (at === -1) {
    throw new Error('Frame 11 no longer draws the instruction this test measures');
  }

  return FRAME_11.slice(at, FRAME_11.indexOf('</div>', at))
    .replace(/&mdash;/g, '\u2014')
    .trim();
})();

/** The type-scale token whose size is this value, e.g. `12px` -> `meta`. */
function fontSizeToken(px: string): string {
  const theme = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );
  const found = new RegExp(`--text-([a-z0-9-]+):\\s*${px}\\s*;`).exec(theme);

  if (!found?.[1]) {
    throw new Error(`No type-scale token has the size ${px}`);
  }

  return found[1];
}

/*
 * Exact class-token match. `toContain` is not safe for utilities that share a
 * prefix: `'py-2.5'.includes('py-2')` is true, so a `toContain` guard passes on
 * a 10px padding where the frame says 8px — the exact defect the assertion
 * exists to catch.
 */
function hasClass(element: Element, className: string): boolean {
  return element.className.split(/\s+/).includes(className);
}

/** px -> the Tailwind spacing unit that renders it; the scale is 4px per unit. */
function spacingUnit(px: string): string {
  return String(Number.parseFloat(px) / 4);
}

describe('frame 11 parity', () => {
  afterEach(cleanup);

  it('finds the frame and the elements these assertions measure', () => {
    expect(FRAME_11).not.toBe('');
    expect(FRAME_11).toContain('data-screen-label="11 Availability"');
    expect(frameSelectedPanel).toContain('border-radius');
  });

  it('draws the selected panel at the frame radius and padding', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));

    const panel = screen.getByText('Jun 18').parentElement;

    expect(panel?.className).toContain(
      `rounded-[${styleValue(frameSelectedPanel, 'border-radius')}]`,
    );
    expect(panel?.className).toContain(`p-[${styleValue(frameSelectedPanel, 'padding')}]`);
  });

  /*
   * Only the radius. The frame's copy ("Saturdays in June and July are 80%
   * booked across Austin") needs market data the product does not have, and
   * `19-availability.md` defers it Post-MVP with an explicit instruction to
   * state only this vendor's own numbers until then — so the wording
   * deliberately differs and is not a Text finding.
   */
  it('draws the market-note panel at the frame radius', () => {
    renderCalendar();

    const note = screen.getByText(/Saturdays in these three months/);

    expect(note.className).toContain(`rounded-[${styleValue(frameMarketNote, 'border-radius')}]`);
  });

  it('pads the primary selection action the way the frame draws it', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));

    const [padY, padX] = styleValue(frameSpanFor('Block these'), 'padding').split(/\s+/) as [
      string,
      string,
    ];
    const action = screen.getByRole('button', { name: 'Block these' });

    expect(action.className).toContain(`py-${spacingUnit(padY)}`);
    expect(action.className).toContain(`px-${spacingUnit(padX)}`);
  });

  it('pages the months with the frame glyphs, in the frame colour', () => {
    renderCalendar();

    const back = screen.getByRole('button', { name: 'Show earlier months' });
    const forward = screen.getByRole('button', { name: 'Show later months' });

    // The literal glyphs, read out of the frame rather than duplicated here.
    const glyphs = [...frameNavGlyphs.matchAll(/>([\u2039\u203a])</g)].map((hit) => hit[1]);

    expect(glyphs).toEqual(['\u2039', '\u203a']);
    expect(back.textContent).toBe(glyphs[0]);
    expect(forward.textContent).toBe(glyphs[1]);

    // Muted, not the clay an action would use.
    const token = colourToken(styleValue(frameNavGlyphStyle, 'color'));

    expect(back.className).toContain(`text-${token}`);
    expect(forward.className).toContain(`text-${token}`);

    /*
     * `04-laws.md`: an icon-only control keeps a 44x44 target, and it has to be
     * a real in-flow box. An absolutely positioned pseudo-element hung off the
     * 16px glyph box gets clipped by `section.app-pane`'s `overflow-y: auto`,
     * measured at 43px on the page. jsdom has no layout, so this asserts the
     * mechanism; the browser pass measures the reach.
     */
    expect(hasClass(back, 'size-11')).toBe(true);
    expect(hasClass(forward, 'size-11')).toBe(true);
    expect(back.className).not.toContain('before:');
    expect(forward.className).not.toContain('before:');
  });

  /*
   * `40-states.md`: clay is the action colour. `Clear` only drops a selection,
   * so the frame keeps it in body stone and the clay was overstating it.
   */
  it('paints the secondary selection action in the frame colour, not clay', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(cell('2026-06-18'));

    const token = colourToken(styleValue(frameSpanFor('Clear'), 'color'));

    expect(screen.getByRole('button', { name: 'Clear' }).className).toContain(`text-${token}`);
  });

  it('sets day numerals at the frame size, from the type scale', () => {
    renderCalendar();

    const token = fontSizeToken(styleValue(frameDayGrid, 'font-size'));

    expect(token).toBe('meta');
    expect(cell('2026-06-18').className).toContain(`text-${token}`);
  });

  /*
   * The screen used to tell the vendor two different things 40px apart: the
   * rail said a click "selects", the pane said it "blocks". The frame draws one
   * instruction, in the pane, so that is the one that survives.
   */
  it('carries exactly one instruction, opening the way the frame does', () => {
    renderCalendar();

    const instructions = screen.queryAllByText(/Click a date to/);

    expect(instructions).toHaveLength(1);

    const opening = `${frameInstruction.split('. ')[0]}.`;

    expect(instructions[0]?.textContent?.trim().startsWith(opening)).toBe(true);
  });

  it('states the empty selection rather than instructing a second time', () => {
    renderCalendar();

    expect(screen.getByText('No dates selected yet.')).toBeDefined();
  });

  /*
   * `04-laws.md`: the document needs a top-level heading. The screen title was
   * an `h2`, so the page had none and the rail's section headings sat at the
   * same level as the thing they sit inside. Queried by role, so this asserts
   * the accessibility tree rather than the tag.
   */
  it('gives the page a top-level heading', () => {
    renderCalendar();

    expect(screen.getByRole('heading', { level: 1, name: 'Availability' })).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the rail section headings below the page heading', () => {
    renderCalendar();

    for (const label of ['Selected', 'Legend', 'This quarter']) {
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeDefined();
    }
  });
});
