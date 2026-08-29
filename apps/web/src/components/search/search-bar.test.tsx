import type { Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar, type SearchBarValues } from './search-bar';
import { SearchStatusProvider, useSearchStatus } from './search-status';

/** Drives the provider into a given state, since it owns its own boolean. */
function SearchStatusHarness({
  searching,
  children,
}: {
  searching: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <SearchStatusProvider>
      <SetSearching searching={searching} />
      {children}
    </SearchStatusProvider>
  );
}

function SetSearching({ searching }: { searching: boolean }): null {
  const { setSearching } = useSearchStatus();
  useEffect(() => {
    setSearching(searching);
  }, [searching, setSearching]);

  return null;
}

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

/**
 * The pill/circle split is deliberate, and the rule is about the bar's role
 * rather than the viewport. What is *not* allowed is the third shape the
 * frames were once drawn with: a clay circle holding nothing at all, which
 * reads as decoration rather than as a control.
 */
describe('SearchBar — pill and circle discipline', () => {
  afterEach(cleanup);

  it('labels the submit control by default, for the hero and the full-width bar', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    expect(screen.getByRole('button', { name: 'Search' }).textContent).toBe('Search');
  });

  it('keeps the label on the full-width bar even at its compact size', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Search' }).textContent).toBe('Search');
  });

  /*
   * #84. Frame `01 Landing` draws the hero submit 102.2x44 at `padding:13px
   * 28px`; the app drew it 92.55x38 from `px-6 py-2.75 text-base`. The bar's
   * height follows its tallest child, so this is also what puts the bar back
   * on the frame's 58px — it had dropped to 52 when the button shrank.
   */
  it('draws the hero submit at the padding and size frame 01 Landing measures', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    const submit = screen.getByRole('button', { name: 'Search' });

    expect(submit.className).toContain('sm:px-7');
    expect(submit.className).toContain('sm:py-3.25');
    expect(submit.className).toContain('sm:text-cta');
    expect(submit.className).not.toContain('sm:text-base');
  });

  /*
   * #89. The halo is on the pill, so it is identical whichever segment holds
   * focus — focusing `Vendor type` and focusing `City` rendered pixel-
   * identically and a keyboard user could not tell which was active. Each
   * segment now tints while the control inside it has focus. Asserted on the
   * class because jsdom resolves neither `:focus-visible` nor `has-()`.
   */
  it('marks which segment has focus, not just that the bar has it', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    for (const name of ['City', 'Event date']) {
      expect(screen.getByText(name).closest('label')?.className).toContain(
        'has-[:focus-visible]:bg-clay-400/10',
      );
    }
  });

  it('drops the visible label in the compact header, never the accessible one', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} action="icon" />);

    const button = screen.getByRole('button', { name: 'Search' });

    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Search');
  });

  /* A circle without a glyph is not a reduced control, it is an unlabelled one. */
  it('never renders a bare ring — the circle always holds the magnifier', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} action="icon" />);

    const button = screen.getByRole('button', { name: 'Search' });

    expect(button.querySelector('[aria-hidden]')).not.toBeNull();
    // The ring and its stem: two elements, or it is not a magnifier.
    expect(button.querySelectorAll('span')).toHaveLength(2);
  });

  it('still submits the query from the icon-only control', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SearchBar
        categories={CATEGORIES}
        value={{ category: 'photography', city: 'Austin', date: '' }}
        onSubmit={onSubmit}
        action="icon"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSubmit).toHaveBeenCalledWith({ category: 'photography', city: 'Austin', date: '' });
  });
});

/**
 * Frames `17` and `25 — loading` put a spinner in the compact bar's control
 * while a search runs. The flag crosses a component boundary to get there:
 * the results own the fetch, the bar lives in the header.
 */
describe('SearchBar — while a search is in flight', () => {
  afterEach(cleanup);

  function renderSearching(searching: boolean) {
    return render(
      <SearchStatusHarness searching={searching}>
        <SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} action="icon" />
      </SearchStatusHarness>,
    );
  }

  it('swaps the magnifier for the ring, keeping the control', () => {
    renderSearching(true);

    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.querySelector('[role=status]')).not.toBeNull();
    // The circle itself is unchanged, so the target does not move.
    expect(button.className).toContain('rounded-full');
  });

  it('shows the magnifier again once the search lands', () => {
    renderSearching(false);

    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.querySelector('[role=status]')).toBeNull();
    expect(button.querySelector('[aria-hidden]')).not.toBeNull();
  });

  /* The hero is never inside the provider, so it must not care. */
  it('leaves the labelled pill alone', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    expect(screen.getByRole('button', { name: 'Search' }).textContent).toBe('Search');
  });
});

describe('SearchBar — the compact bar’s own measurements', () => {
  afterEach(cleanup);

  /* 40px at 1024, 42px from 1280 — frames `25` and `17`/`18`. */
  it('takes the frame’s heights from lg up', () => {
    const { container } = render(
      <SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} />,
    );
    const form = container.querySelector('form');

    expect(form?.className).toContain('lg:h-10');
    expect(form?.className).toContain('xl:h-[42px]');
  });

  it('shortens the date label, which is what leaves room for a date', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} />);

    expect(screen.getByText('Date')).toBeDefined();
    expect(screen.queryByText('Event date')).toBeNull();
  });

  it('spells it out on the hero, where there is room', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    expect(screen.getByText('Event date')).toBeDefined();
  });
});
