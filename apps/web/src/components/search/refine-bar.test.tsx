import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RefineBar } from './refine-bar';
import type { SearchState } from './search-state';

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

    // The frame's chip: `stone-0` fill, `stone-300` hairline, 8px radius,
    // 12.5px semibold, 7px/13px padding — the resting tone, shared with the
    // filter chips so the two cannot drift apart.
    expect(trigger.textContent).toBe('Most relevant▾');
    expect(trigger.className).toContain('py-1.75');
    expect(trigger.className).toContain('pl-3.25');
    expect(trigger.className).toContain('pr-3.25');

    const chip = trigger.parentElement as HTMLElement;
    expect(chip.className).toContain('rounded-md');
    expect(chip.className).toContain('border-stone-300');
    expect(chip.className).toContain('bg-stone-0');
    expect(chip.className).toContain('text-[12.5px]');
    expect(chip.className).toContain('font-semibold');
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
