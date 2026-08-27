import type { Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar, type SearchBarValues } from './search-bar';

const CATEGORIES: Category[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Photography',
    slug: 'photography',
    description: 'Portraits, candids, photo booths, and full-day coverage.',
    icon: 'camera',
    displayOrder: 1,
    isActive: true,
  },
];

const EMPTY: SearchBarValues = { category: '', city: '', date: '' };

function renderBar(value: SearchBarValues = EMPTY, onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...render(<SearchBar categories={CATEGORIES} value={value} onSubmit={onSubmit} size="hero" />),
  };
}

/** The event-date field. Named "Event date" by the label that wraps it. */
function dateInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="date"]');

  if (!input) {
    throw new Error('no date input');
  }

  return input;
}

const TODAY = '2026-06-14';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Local noon, so the local day and the UTC day agree in any test runner
    // timezone — the assertions are about past-vs-future, not about offsets.
    vi.setSystemTime(new Date(2026, 5, 14, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('labels its three segments exactly as the frames do', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Vendor type' })).toBeDefined();
    expect(screen.getByText('City')).toBeDefined();
    expect(screen.getByText('Event date')).toBeDefined();
  });

  it('prompts "Add a date" while the date is empty, never the browser default', () => {
    renderBar();

    // A date input has no placeholder, so the prompt is laid over the native
    // editor — see design/design-plan/10-landing.md.
    expect(screen.getByText('Add a date')).toBeDefined();
  });

  it('drops the prompt once a date has been chosen', () => {
    renderBar({ ...EMPTY, date: '2026-06-14' });

    expect(screen.queryByText('Add a date')).toBeNull();
  });

  it('offers no free-text query field — the first segment is a picker', () => {
    renderBar();

    // City is the only text box on the bar; vendor type is a select.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});

/*
 * Availability is only recorded forward, so a past event date asks about a day
 * the calendar has nothing to say about. The rule is shown in the control
 * rather than discovered on submit.
 */
describe('SearchBar — the event date cannot be in the past', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 5, 14, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('floors the picker at today, so past days are unselectable', async () => {
    const { container } = renderBar();

    // The floor resolves after mount: "today" is the viewer's local day, and
    // rendering it on the server would be a different one.
    await vi.waitFor(() => {
      expect(dateInput(container).min).toBe(TODAY);
    });
  });

  it('lets today itself through — an event happening today is still bookable', async () => {
    const user = userEvent.setup();
    const { container, onSubmit } = renderBar({ ...EMPTY, date: TODAY });

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSubmit).toHaveBeenCalledWith({ ...EMPTY, date: TODAY });
    expect(dateInput(container).getAttribute('aria-invalid')).toBeNull();
  });

  it('holds back a search carrying a past date, and says why', async () => {
    const user = userEvent.setup();
    const { container, onSubmit } = renderBar({ ...EMPTY, date: '2026-06-13' });

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'That date has already passed — pick today or a later date.',
    );
    expect(dateInput(container).getAttribute('aria-invalid')).toBe('true');
  });

  /* Nothing is silently corrected: the value stays put so it can be fixed. */
  it('keeps the rejected date in the field rather than clearing it', async () => {
    const user = userEvent.setup();
    const { container } = renderBar({ ...EMPTY, date: '2026-06-13' });

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(dateInput(container).value).toBe('2026-06-13');
  });

  it('clears the complaint as soon as the date is changed', async () => {
    const user = userEvent.setup();
    const { container } = renderBar({ ...EMPTY, date: '2026-06-13' });

    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toBeDefined();

    await user.clear(dateInput(container));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /*
   * A tab left open across midnight has a stale floor, so the submitted value
   * is judged against a fresh clock rather than against `min`.
   */
  it('re-checks against the clock at submit, not against the mounted floor', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderBar({ ...EMPTY, date: TODAY });

    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeDefined();
  });
});

/*
 * The query bar carries the two primary conversion controls on the site, on
 * both the landing hero and the search header. Each visible micro-label is a
 * `<span>` inside the `<label>` that wraps its input, so the name comes from
 * the wrapper rather than a `for` attribute — which is easy to break by
 * lifting an input out of its label during a layout change. These assert the
 * computed accessible name, which is the thing that actually has to hold.
 */
describe('SearchBar accessible names', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(['hero', 'compact'] as const)('names every control in the %s bar', (size) => {
    const { container } = render(
      <SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size={size} />,
    );

    expect(screen.getByRole('textbox', { name: 'City' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDefined();
    expect(screen.getByRole('button', { name: /vendor type/i })).toBeDefined();

    /*
     * The date input is asserted through its label rather than by role:
     * Chromium exposes `input[type=date]` as a named `textbox`, jsdom gives it
     * no role at all, so a role query here would test the test environment.
     * The loop below is the check that transfers.
     */
    // Nothing focusable is left anonymous.
    const controls = container.querySelectorAll('input, select, textarea');

    expect(controls).toHaveLength(2);

    for (const control of controls) {
      const labels = Array.from((control as HTMLInputElement).labels ?? []);
      const named =
        control.getAttribute('aria-label') ??
        control.getAttribute('aria-labelledby') ??
        labels.map((label) => label.textContent ?? '').join('');

      expect(named.trim()).not.toBe('');
    }
  });
});
