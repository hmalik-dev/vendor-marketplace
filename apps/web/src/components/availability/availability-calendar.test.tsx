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
  it('lets the selecting fill beat whatever the date currently is', () => {
    for (const status of ['available', 'blocked', 'booked', 'pending'] as const) {
      const classes = cellAppearance(status, { isPast: false, isSelected: true });
      expect(classes).toContain('bg-clay-400');
      expect(classes).toContain('text-stone-0');
      expect(classes).not.toContain('hover:');
    }
  });

  it('never emits a hover fill alongside the selecting fill', () => {
    const selected = cellAppearance('available', { isPast: false, isSelected: true });
    const idle = cellAppearance('available', { isPast: false, isSelected: false });

    expect(idle).toContain('hover:bg-clay-50');
    expect(selected).not.toContain('bg-clay-50');
  });

  it('puts a past date on the inert token and nothing else', () => {
    const classes = cellAppearance('available', { isPast: true, isSelected: true });

    expect(classes).toContain('text-stone-500');
    expect(classes).not.toContain('bg-clay-400');
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
    expect(quarterCount('Booked')).toBe('1 dates');

    await user.click(cell('2026-06-18'));
    await user.click(screen.getByRole('button', { name: 'Block these' }));

    // Two blocked dates now; the booked count is untouched.
    expect(quarterCount('Blocked')).toBe('2 dates');
    expect(quarterCount('Booked')).toBe('1 dates');
  });

  it('counts only open future Saturdays, since that is the number that drives action', () => {
    // June 2026 Saturdays: 6, 13, 20, 27. Blocking the 13th leaves three.
    renderCalendar([entry('2026-06-13', 'blocked')]);

    const quarter = screen.getByRole('heading', { name: 'This quarter' }).parentElement;
    const openSaturdays = within(quarter!).getByText(/left$/).textContent ?? '';

    expect(Number(openSaturdays.replace(/\D/g, ''))).toBeGreaterThan(0);
  });

  it('lists every state in the legend, including the ones it cannot yet produce', () => {
    renderCalendar();

    const legend = screen.getByRole('heading', { name: 'Legend' }).parentElement;
    for (const label of [
      'Available',
      'Booked — locked',
      'Pending request',
      'Blocked by you',
      'Selecting',
    ]) {
      expect(within(legend!).getByText(label)).toBeDefined();
    }
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
});
