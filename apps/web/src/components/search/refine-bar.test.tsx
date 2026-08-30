import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RefineBar } from './refine-bar';
import type { SearchState } from './search-state';

/*
 * The Refine bar is a desktop surface — below `lg` it lives inside the search
 * shell's own sheet — so the suite drives the **anchored** dropdown mount.
 * jsdom's stub in `vitest.setup.ts` answers every media query "no", which would
 * put every assertion below against the bottom sheet instead: a different
 * mount, tested by accident.
 */
beforeEach(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('min-width: 640px'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

/*
 * Frame `02 Search` draws the sort control, so its numbers are read out of the
 * bundle at test time rather than written here — otherwise a design re-import
 * moves the contract and this file still passes.
 */
const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** The frame's sort chip: the `Top rated ▾` span in the Refine bar. */
const frameSortChip = (() => {
  const frame = frameHtml.slice(frameHtml.indexOf('data-screen-label="02 Search"'));
  const chip = frame.indexOf('Top rated');
  const open = frame.lastIndexOf('<span', chip);

  return frame.slice(open, chip);
})();

function frameStyle(property: string): string {
  const declaration = new RegExp(`[;"]${property}:([^;"]+)`).exec(frameSortChip);

  if (!declaration?.[1]) {
    throw new Error(`Frame 02's sort chip does not set \`${property}\``);
  }

  return declaration[1].trim();
}

/** px → the Tailwind spacing unit that renders it; the scale is 4px per unit. */
function spacingUnit(px: string): string {
  return String(Number.parseFloat(px) / 4);
}

function state(overrides: Partial<SearchState> = {}): SearchState {
  return {
    name: '',
    category: '',
    city: '',
    state: '',
    minPriceCents: null,
    maxPriceCents: null,
    date: '',
    minRating: null,
    tags: [],
    sort: 'relevance',
    page: 1,
    ...overrides,
  };
}

function renderBar(overrides: Partial<SearchState> = {}): HTMLElement {
  const { container } = render(
    <RefineBar
      state={state(overrides)}
      setState={vi.fn()}
      clearRefinements={vi.fn()}
      tags={[]}
      facets={[]}
    />,
  );

  return container.firstElementChild as HTMLElement;
}

describe('RefineBar layout', () => {
  afterEach(() => cleanup());

  /*
   * The active chip's `✕` carries its 44x44 hit area as an `::after` anchored
   * 8px to the right (#245), and 8px is free space only because the chip row's
   * gutter is 8px. At `gap-1` the same overhang would cover 4px of the NEXT
   * chip's trigger, so the two numbers are one fact and are asserted together.
   *
   * Read off the rendered row, not grepped from the source: the file also
   * contains `gap-2.5` on the tag-option label, so a substring search matched
   * whatever the row happened to say.
   */
  it('leaves the gutter the ✕ hit area is anchored into', () => {
    const bar = renderBar({ minRating: 4 });
    const row = bar.querySelector('.flex-wrap');

    expect(row?.className).toMatch(/(?:^|\s)gap-2(?:\s|$)/);
  });

  /*
   * `30-responsive.md`: a wrapping row wraps for width, never for alignment.
   * With `Sort` inside the wrap carrying `ml-auto`, its own margin ate the
   * line's free space, so the break point depended on where the right-aligned
   * item wanted to sit rather than on how wide the chips were.
   */
  it('does not wrap the bar itself — the chips wrap inside their own group', () => {
    const bar = renderBar();

    expect(bar.className).not.toContain('flex-wrap');

    const chipGroup = bar.firstElementChild as HTMLElement;
    expect(chipGroup.className).toContain('flex-wrap');
    expect(chipGroup.textContent).toContain('Refine');
  });

  it('holds Sort outside the wrapping group, with no auto margin', () => {
    const bar = renderBar();
    // `Sort` names the chip beside it rather than wrapping a control, so the
    // container is a plain element — the layout rule below is what matters.
    const sort = screen.getByText('Sort').closest('div') as HTMLElement;

    expect(sort.parentElement).toBe(bar);
    expect(sort.className).not.toContain('ml-auto');
    expect(sort.className).toContain('shrink-0');
  });

  /*
   * #98. Frame `02` draws sort as a chip, like every other control on this
   * bar. A native `select` is sized and placed by the platform, so it came out
   * 148x33 against the frame's 92x31 and 56px to the left of it — none of
   * which a stylesheet can correct.
   */
  it('draws sort as a chip rather than a native select', () => {
    const bar = renderBar();

    expect(bar.querySelector('select')).toBeNull();

    const trigger = screen.getByRole('button', { name: 'Sort: Most relevant' });
    const chip = trigger.parentElement as HTMLElement;

    expect(trigger.textContent).toBe('Most relevant▾');

    // Every number below is the frame's own, read at test time.
    const [padY, padX] = frameStyle('padding').split(/\s+/) as [string, string];

    expect(trigger.className).toContain(`py-${spacingUnit(padY)}`);
    expect(trigger.className).toContain(`pl-${spacingUnit(padX)}`);
    expect(trigger.className).toContain(`pr-${spacingUnit(padX)}`);
    expect(chip.className).toContain(`text-[${frameStyle('font-size')}]`);
    expect(chip.className).toContain('font-semibold');
    expect(frameStyle('font-weight')).toBe('600');

    // 8px is `--radius-md`, and #E4DDD1 / #FFFDF9 are stone-300 / stone-0.
    expect(frameStyle('border-radius')).toBe('8px');
    expect(chip.className).toContain('rounded-md');
    expect(frameStyle('border')).toBe('1px solid #E4DDD1');
    expect(chip.className).toContain('border-stone-300');
    expect(frameStyle('background')).toBe('#FFFDF9');
    expect(chip.className).toContain('bg-stone-0');
  });

  /*
   * The control this replaced was a native `<select>`, which came with its own
   * behaviour. The replacement does not, so the behaviour is asserted here:
   * without this, dropping the `onChange` still passes every other test.
   */
  it.each([
    ['Top rated', 'rating'],
    ['Price: low to high', 'price_asc'],
    ['Price: high to low', 'price_desc'],
    ['Newest', 'newest'],
    ['Most relevant', 'relevance'],
  ])('sorts by %s when it is chosen', async (label, expected) => {
    const user = userEvent.setup();
    const setState = vi.fn();
    render(
      <RefineBar
        state={state({ sort: expected === 'relevance' ? 'rating' : 'relevance' })}
        setState={setState}
        clearRefinements={vi.fn()}
        tags={[]}
        facets={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Sort:/ }));
    await user.click(screen.getByRole('option', { name: label }));

    expect(setState).toHaveBeenCalledWith({ sort: expected });
  });

  it('marks the current sort as the checked option', async () => {
    const user = userEvent.setup();
    render(
      <RefineBar
        state={state({ sort: 'price_desc' })}
        setState={vi.fn()}
        clearRefinements={vi.fn()}
        tags={[]}
        facets={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Sort: Price: high to low' }));

    expect(
      screen.getByRole('option', { name: 'Price: high to low' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('option', { name: 'Top rated' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  /* A single-choice panel is answered by the choice, and it covers the results. */
  it('dismisses itself once a sort is chosen', async () => {
    const user = userEvent.setup();
    render(
      <RefineBar
        state={state()}
        setState={vi.fn()}
        clearRefinements={vi.fn()}
        tags={[]}
        facets={[]}
      />,
    );

    const trigger = screen.getByRole('button', { name: /^Sort:/ });

    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'Top rated' })).toBeDefined();

    await user.click(screen.getByRole('option', { name: 'Top rated' }));

    expect(screen.queryByRole('option', { name: 'Top rated' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps every chip and Clear inside the wrapping group', () => {
    const bar = renderBar({ minRating: 4 });
    const chipGroup = bar.firstElementChild as HTMLElement;

    expect(chipGroup.textContent).toContain('Price');
    expect(chipGroup.textContent).toContain('Clear');
    expect(chipGroup.textContent).not.toContain('Sort');
  });

  /* Inside the mobile filter sheet the two groups stack rather than sharing a row. */
  it('stacks the groups below lg and puts them on one row from lg', () => {
    const bar = renderBar();

    expect(bar.className).toContain('flex-col');
    expect(bar.className).toContain('lg:flex-row');
  });
});

/*
 * #69. Every option in every filter has to be reachable, and a panel that has
 * been answered has to get out of the way.
 *
 * The measured failures were a 719px Languages panel in a 768px viewport with
 * no internal scroll — its last two options clicked but never fired — and a
 * Rating panel that applied the choice and then sat over the results heading
 * and the first result card.
 */
describe('filter popovers are reachable and know when they are finished', () => {
  const TAGS = [
    {
      id: 'a1111111-1111-4111-8111-111111111111',
      name: 'English',
      category: 'language',
      vendorCategorySlug: null,
    },
    {
      id: 'a2222222-2222-4222-8222-222222222222',
      name: 'Spanish',
      category: 'language',
      vendorCategorySlug: null,
    },
  ] as const;

  function renderWithTags(overrides: Partial<SearchState> = {}, setState = vi.fn()) {
    render(
      <RefineBar
        state={state(overrides)}
        setState={setState}
        clearRefinements={vi.fn()}
        tags={TAGS as unknown as React.ComponentProps<typeof RefineBar>['tags']}
        facets={[]}
      />,
    );

    return setState;
  }

  /*
   * The 719px Languages panel, closed by the cap on the shell (#167).
   *
   * jsdom runs no layout, so what is asserted is the rule rather than the
   * rendered box: 360px, and a scroll container to absorb the rest. That number
   * is also what sets the flip distance — "flips when the field is within 380px
   * of the viewport bottom" is the same statement as "flips when 360px of panel
   * plus its 8px offset will not fit below", which is what Radix decides.
   */
  it('caps every panel at the frame’s 360px, and scrolls inside', async () => {
    const user = userEvent.setup();
    renderWithTags();

    await user.click(screen.getByRole('button', { name: /^Language/ }));

    const panel = document.querySelector('[data-slot="dropdown"]');
    expect(panel, 'no dropdown panel').not.toBeNull();

    const className = (panel as HTMLElement).className;
    expect(className).toContain('max-h-[360px]');
    expect(className).toContain('overflow-y-auto');
  });

  /* Single-select: the choice answers the panel, so the panel closes. */
  it('closes the rating panel once a rating is chosen', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    const trigger = screen.getByRole('button', { name: 'Rating' });
    await user.click(trigger);

    await user.click(screen.getByRole('option', { name: '4.5★ & up' }));

    expect(setState).toHaveBeenCalledWith({ minRating: 4.5 });
    expect(screen.queryByRole('option', { name: '4.5★ & up' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  /*
   * **Multi-select does not auto-apply** (#167). It used to fire per tick, so
   * ticking three languages re-queried and re-sorted the grid three times,
   * moving the list under the hand that was still choosing. Now the ticks build
   * a draft and Apply commits it — which is also what closes the panel.
   */
  it('holds a multi-select choice back until Apply', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    await user.click(screen.getByRole('button', { name: /^Language/ }));
    await user.click(screen.getByRole('option', { name: 'English' }));

    // Ticked, and still nothing has reached the results grid.
    expect(screen.getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(setState).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply · 1' }));

    expect(setState).toHaveBeenCalledWith({ tags: [TAGS[0].id] });
  });

  /* Abandoning the panel discards the draft rather than leaking it. */
  it('discards a multi-select draft when the panel is dismissed', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    await user.click(screen.getByRole('button', { name: /^Language/ }));
    await user.click(screen.getByRole('option', { name: 'English' }));
    await user.keyboard('{Escape}');

    expect(setState).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Language/ }));

    expect(screen.getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  /*
   * The range is presets first, then typed bounds, then a slider that is only a
   * readout — and it applies on Apply for the same reason the multi-select
   * does: a range fired per keystroke re-sorts between the two digits of "18".
   */
  it('offers presets and typed bounds, and applies neither until Apply', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    await user.click(screen.getByRole('button', { name: 'Price' }));

    expect(screen.getByRole('button', { name: 'Under $1k' })).toBeDefined();
    expect(screen.getByLabelText('Min')).toBeDefined();
    expect(screen.getByLabelText('Max')).toBeDefined();

    await user.click(screen.getByRole('button', { name: '$1–2k' }));
    expect(setState).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(setState).toHaveBeenCalledWith({ minPriceCents: 100_000, maxPriceCents: 200_000 });
  });

  /*
   * Moving between chips takes **one** click, not two.
   *
   * Only one panel may be open, and that is held on the bar rather than in each
   * chip — so clicking B while A is open fires both A's close and B's open. With
   * a naive handler A's close landed second and wiped B straight back out, and
   * the bar looked unresponsive to the first click on every chip after the first.
   */
  it('moves from one open chip to the next in a single click', async () => {
    const user = userEvent.setup();
    renderWithTags();

    await user.click(screen.getByRole('button', { name: 'Price' }));
    expect(screen.getByRole('button', { name: 'Under $1k' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Rating' }));

    expect(screen.getByRole('option', { name: '4★ & up' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Under $1k' })).toBeNull();
  });

  /* No `input[type=range]` is the control any more — it is a readout. */
  it('draws the slider as a readout rather than the only control', async () => {
    const user = userEvent.setup();
    renderWithTags();

    await user.click(screen.getByRole('button', { name: 'Price' }));

    expect(document.querySelector('input[type="range"]')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

/*
 * #92/#281. Frame `02` draws six refine chips; live rendered five, because
 * there was no `style` group in the data model for the sixth to read from.
 *
 * The chip's own rule is what makes it more than a fourth copy of the other
 * three: `11-search.md` has its option set change with the selected vendor
 * type, so a style tag belongs to one category while a language belongs to all
 * of them.
 */
describe('the Style chip', () => {
  /** The chip labels frame `02` draws in its Refine bar, read at test time. */
  const frameChips = (() => {
    const frame = frameHtml.slice(frameHtml.indexOf('data-screen-label="02 Search"'));
    const bar = frame.slice(frame.indexOf('Refine'), frame.indexOf('Sort'));

    return [...bar.matchAll(/>([^<>]*?)\s*▾</g)].map((match) => (match[1] ?? '').trim());
  })();

  const STYLES = [
    {
      id: 'b1111111-1111-4111-8111-111111111111',
      name: 'Documentary',
      category: 'style',
      vendorCategorySlug: 'photography',
    },
    {
      id: 'b2222222-2222-4222-8222-222222222222',
      name: 'Cinematic',
      category: 'style',
      vendorCategorySlug: 'videography',
    },
    {
      id: 'b3333333-3333-4333-8333-333333333333',
      name: 'English',
      category: 'language',
      vendorCategorySlug: null,
    },
  ] as const;

  function renderStyles(category: string) {
    render(
      <RefineBar
        state={state({ category })}
        setState={vi.fn()}
        clearRefinements={vi.fn()}
        tags={STYLES as unknown as React.ComponentProps<typeof RefineBar>['tags']}
        facets={[]}
      />,
    );
  }

  /* Guards the guard: a frame read that stopped matching would pass anything. */
  it('reads six chips out of the frame, Style among them', () => {
    expect(frameChips).toContain('Style');
    expect(frameChips.length).toBeGreaterThanOrEqual(5);
  });

  it('draws the chip the frame draws', () => {
    renderStyles('photography');

    expect(screen.getByRole('button', { name: /^Style/ })).toBeDefined();
  });

  /*
   * The scoping, asserted from the rendered options rather than from the
   * filter expression — "Cinematic" is a real style and a real tag, and the
   * only thing wrong with it here is that this customer is looking for a
   * photographer.
   */
  it('offers only the styles belonging to the selected vendor type', async () => {
    renderStyles('photography');

    await userEvent.click(screen.getByRole('button', { name: /^Style/ }));

    expect(screen.getByRole('option', { name: /Documentary/ })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: /Cinematic/ })).toBeNull();
  });

  it('swaps the option set with the vendor type', async () => {
    renderStyles('videography');

    await userEvent.click(screen.getByRole('button', { name: /^Style/ }));

    expect(screen.getByRole('option', { name: /Cinematic/ })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: /Documentary/ })).toBeNull();
  });

  /*
   * With no type chosen there is no option set, and fifty styles across eleven
   * trades is not a filter. The chip is absent rather than present and empty —
   * a control that opens onto nothing is the dead-control defect.
   */
  it('is absent entirely when no vendor type is selected', () => {
    renderStyles('');

    expect(screen.queryByRole('button', { name: /^Style/ })).toBeNull();
    // The unscoped groups are unaffected by the vendor type.
    expect(screen.getByRole('button', { name: /^Language/ })).toBeDefined();
  });
});
