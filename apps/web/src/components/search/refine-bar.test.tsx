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
    const sort = screen.getByText('Sort').closest('label') as HTMLElement;

    expect(sort.parentElement).toBe(bar);
    expect(sort.className).not.toContain('ml-auto');
    expect(sort.className).toContain('shrink-0');
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
