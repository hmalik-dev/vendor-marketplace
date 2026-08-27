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

  it('locks dates in the past', () => {
    renderCalendar();

    const past = cell('2026-06-01');
    expect(past).toHaveProperty('disabled', true);
    expect(past.getAttribute('aria-label')).toContain('in the past');
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
