import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RefineBar } from './refine-bar';
import type { SearchState } from './search-state';

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
    await user.click(screen.getByRole('radio', { name: label }));

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

    expect(screen.getByRole('radio', { name: 'Price: high to low' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByRole('radio', { name: 'Top rated' })).toHaveProperty('checked', false);
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
    expect(screen.getByRole('radio', { name: 'Top rated' })).toBeDefined();

    await user.click(screen.getByRole('radio', { name: 'Top rated' }));

    expect(screen.queryByRole('radio', { name: 'Top rated' })).toBeNull();
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
    { id: 'a1111111-1111-4111-8111-111111111111', name: 'English', category: 'language' },
    { id: 'a2222222-2222-4222-8222-222222222222', name: 'Spanish', category: 'language' },
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
   * The cap is on the primitive, so it holds for popovers nobody measured.
   * jsdom runs no layout and Radix computes the variable from real measurement,
   * so what is asserted is the rule: a height bounded by the available space,
   * and a scroll container to absorb the overflow.
   */
  it('caps every panel against the space it opens into, and scrolls inside', async () => {
    const user = userEvent.setup();
    renderWithTags();

    await user.click(screen.getByRole('button', { name: /^Language/ }));

    const panel = document.querySelector('[data-slot="popover-content"]');
    expect(panel, 'no popover panel').not.toBeNull();

    const className = (panel as HTMLElement).className;
    expect(className).toContain('max-h-(--radix-popover-content-available-height)');
    expect(className).toContain('overflow-y-auto');
  });

  /* Single-select: the choice answers the panel, so the panel closes. */
  it('closes the rating panel once a rating is chosen', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    const trigger = screen.getByRole('button', { name: 'Rating' });
    await user.click(trigger);

    const option = screen.getByRole('button', { name: '4.5★ & up' });
    await user.click(option);

    expect(setState).toHaveBeenCalledWith({ minRating: 4.5 });
    expect(screen.queryByRole('button', { name: '4.5★ & up' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  /*
   * Multi-select: staying open is the point, so it has to be the stated
   * behaviour rather than the same defect the rating panel just lost.
   */
  it('keeps a multi-select panel open across a choice, and says why', async () => {
    const user = userEvent.setup();
    const setState = renderWithTags();

    await user.click(screen.getByRole('button', { name: /^Language/ }));
    expect(screen.getByText(/this stays open/)).toBeDefined();

    await user.click(screen.getByRole('checkbox', { name: 'English' }));

    expect(setState).toHaveBeenCalledWith({ tags: [TAGS[0].id] });
    expect(screen.getByRole('checkbox', { name: 'Spanish' })).toBeDefined();
  });

  it('says the price panel stays open too, since a range has two ends', async () => {
    const user = userEvent.setup();
    renderWithTags();

    await user.click(screen.getByRole('button', { name: 'Price' }));

    expect(screen.getByText('Set either end — this stays open.')).toBeDefined();
    expect(screen.getByLabelText(/Minimum/i)).toBeDefined();
  });
});
