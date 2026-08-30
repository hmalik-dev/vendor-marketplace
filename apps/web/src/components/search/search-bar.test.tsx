import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

  /*
   * #282, residual from the #235 re-measurement. Frame `01` draws this
   * segment as plain text with no icon at all; a bare `type="date"` input
   * paints Chrome's own calendar glyph regardless of the prompt text laid
   * over it. Asserted as a class-level fact — jsdom does not render the
   * pseudo-element, so there is nothing here for a rendered-pixel check to
   * read; see `web-design-parity.md` on asserting what a check can actually
   * fail on.
   */
  it('hides the native calendar glyph the frame does not draw', () => {
    const { container } = renderBar();

    expect(dateInput(container).className).toContain(
      '[&::-webkit-calendar-picker-indicator]:opacity-0',
    );
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
  /*
   * Three landing frames draw this pill, not one: `13px / 12 24` at 768,
   * `13px / 11 20` at 1024 and `14px / 13 28` at 1440. It used to carry only
   * the 1440 values, pinned to `sm` — so a 102x44 control sat in the 50px bar
   * the 1024 frame draws.
   */
  it('steps the hero submit through all three frames that draw it', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    const submit = screen.getByRole('button', { name: 'Search' });

    // 768 — the unprefixed `sm` step.
    expect(submit.className).toContain('sm:px-6');
    expect(submit.className).toContain('sm:py-3');
    expect(submit.className).toContain('sm:text-[13px]');

    // 1024.
    expect(submit.className).toContain('lg:px-5');
    expect(submit.className).toContain('lg:py-2.75');

    // 1440 — frame `01 Landing`, which is where these values came from.
    expect(submit.className).toContain('min-[90rem]:px-7');
    expect(submit.className).toContain('min-[90rem]:py-3.25');
    expect(submit.className).toContain('min-[90rem]:text-cta');

    // The 1440 size must not start at 640 again.
    expect(submit.className).not.toContain('sm:text-cta');
    expect(submit.className).not.toContain('sm:text-base');
  });

  /*
   * #253. The button's own box was already exact once #84 landed — this is the
   * *segments*. Frame `01 Landing` gives the hero submit `margin-left: 0`; the
   * app gave it `sm:ml-2`. The bar's total width matches either way (727.594px),
   * so those 8px came straight out of the three flex segments: Vendor type
   * 229.97 against the frame's 233.33, City 194.91 against 197.48, Event date
   * 159.52 against 161.58.
   *
   * The compact bar is a different control and keeps its own `sm:ml-1.5`.
   */
  it("gives the hero submit no left margin, so the segments keep the frame's width", () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} size="hero" />);

    const submit = screen.getByRole('button', { name: 'Search' });

    expect(submit.className).not.toContain('sm:ml-2');
    expect(submit.className).not.toMatch(/(^|\s)ml-/);
  });

  it("leaves the compact bar's own submit margin alone", () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Search' }).className).toContain('sm:ml-1.5');
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

  /*
   * #94 (Access half). #57 settled that the compact header keeps the circle
   * rather than the frame 02 text pill, so the 44x44 law in `04-laws.md:133`
   * has to be met without changing what is painted — the target is grown past
   * the circle instead. `size-11` is 44px.
   *
   * The rendered hit area is what actually matters, so the browser pass probes
   * `elementFromPoint` at the target corners; this asserts the control carries
   * the rule at all, which is what a component test can see.
   */
  it('gives the icon-only circle a 44x44 hit area past its own paint', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} action="icon" />);

    const button = screen.getByRole('button', { name: 'Search' });

    // Painted at the size the frames draw — the circle must not have grown.
    expect(button.className).toContain('size-7.5');
    expect(button.className).toContain('xl:size-8');

    // and targeted at 44, centred on it.
    expect(button.className).toContain('after:size-11');
    expect(button.className).toContain('after:absolute');
    expect(button.className).toContain('after:-translate-x-1/2');
    expect(button.className).toContain('after:-translate-y-1/2');
    expect(button.className).toContain('relative');
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

/**
 * #102 — the date segment rendered the browser's own `09/13/2026` edit field
 * where every search frame draws a formatted value. The expected strings are
 * read out of the design bundle rather than copied here, so the test tracks
 * the contract instead of a snapshot of it.
 */
describe('SearchBar — the picked date is shown in the frames words', () => {
  afterEach(cleanup);

  /** The frame bundle, found by content so no brand literal appears in source. */
  function frameBundle(): string {
    const designRoot = join(process.cwd(), '../../design');
    const file = readdirSync(designRoot)
      .filter((entry) => entry.endsWith('.dc.html'))
      .map((entry) => readFileSync(join(designRoot, entry), 'utf8'))
      .find((contents) => contents.includes('data-screen-label'));

    expect(file).toBeDefined();

    return file as string;
  }

  /** The date literal a named frame draws, read from its own markup. */
  function dateLiteralIn(frameLabel: string): string {
    const bundle = frameBundle();
    const start = bundle.indexOf(`data-screen-label="${frameLabel}"`);

    expect(start).toBeGreaterThan(-1);

    const block = bundle.slice(start, start + 7000);
    const match = block.match(/>\s*((?:Sun, )?[A-Z][a-z]{2} \d{1,2}(?:, \d{4})?)\s*</);

    expect(match).not.toBeNull();

    return (match as RegExpMatchArray)[1] as string;
  }

  const PICKED: SearchBarValues = { category: '', city: '', date: '2026-06-14' };

  it('renders the 1440 frames literal, not the browser picker', () => {
    render(<SearchBar categories={CATEGORIES} value={PICKED} onSubmit={vi.fn()} />);

    // `17 Search loading` and `18 Search no results` both draw `Jun 14, 2026`.
    const literal = dateLiteralIn('17 Search loading');

    expect(screen.getByText(literal).textContent).toBe(literal);
  });

  it('renders the 1024 frames shorter literal alongside it', () => {
    render(<SearchBar categories={CATEGORIES} value={PICKED} onSubmit={vi.fn()} />);

    const literal = dateLiteralIn('27 Search results — 1024');

    expect(screen.getByText(literal).textContent).toBe(literal);
  });

  /*
   * Both spellings are in the DOM and width chooses between them, so the
   * classes are the assertion: resolving a media query in state would render
   * the wrong one on the server and change it under the reader after mount.
   */
  it('hides the year below 1440 and shows it at 1440', () => {
    render(<SearchBar categories={CATEGORIES} value={PICKED} onSubmit={vi.fn()} />);

    expect(screen.getByText(dateLiteralIn('27 Search results — 1024')).className).toContain(
      'xl:hidden',
    );
    expect(screen.getByText(dateLiteralIn('17 Search loading')).className).toContain(
      'max-xl:hidden',
    );
  });

  /*
   * The overlay must never replace the picker — focusing hands the field back
   * to the browser's own editor, which is the only way to change the date.
   */
  it('keeps the native date input, so the picker still opens', () => {
    const { container } = render(
      <SearchBar categories={CATEGORIES} value={PICKED} onSubmit={vi.fn()} />,
    );

    const input = container.querySelector('input[type="date"]');

    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe('2026-06-14');
    expect((input as HTMLInputElement).className).toContain('peer');
  });

  it('still draws the prompt, not a literal, while no date is picked', () => {
    render(<SearchBar categories={CATEGORIES} value={EMPTY} onSubmit={vi.fn()} />);

    expect(screen.getByText('Add a date').textContent).toBe('Add a date');
    expect(screen.queryByText(/2026/)).toBeNull();
  });

  /*
   * `?date=` is attacker-writable. An unparseable value reaching `Intl` throws
   * `RangeError: Invalid time value`, which is a 500 on a URL anyone can paste
   * — the exact class `web-route-boundaries.md` exists to prevent.
   */
  it.each(['not-a-date', '2026-13-45', '0000-00-00'])('renders %s without throwing', (hostile) => {
    expect(() =>
      render(
        <SearchBar
          categories={CATEGORIES}
          value={{ category: '', city: '', date: hostile }}
          onSubmit={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
