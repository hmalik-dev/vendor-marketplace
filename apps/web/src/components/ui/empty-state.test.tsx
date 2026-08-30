import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState, EmptyStateGlyph } from './empty-state';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the headline at the frames’ 26px display step, not 21px', () => {
    render(<EmptyState headline="No requests yet" description="Nothing has come in." />);

    const heading = screen.getByRole('heading', { name: 'No requests yet' });

    // `40-states.md`: Instrument Serif at 26px in-app. The role carries no
    // tracking, so `font-display` rather than `.display-heading`.
    expect(heading.className).toContain('font-display');
    expect(heading.className).toContain('text-display-md');
    expect(heading.className).not.toContain('text-display-sm');
  });

  it('sets the sentence to the frame’s 420px measure', () => {
    render(<EmptyState headline="No requests yet" description="Nothing has come in." />);

    expect(screen.getByText('Nothing has come in.').className).toContain('max-w-[420px]');
  });

  /*
   * `40-states.md` names two sizes for this one component — "headline at 26px
   * in-app / 30px marketing" — and frame `18 Search no results` draws the
   * marketing one. The two are asserted together rather than in isolation,
   * because the defect they guard is the pair collapsing into one.
   */
  it('draws the marketing scale at the 30px step and the 520px measure', () => {
    render(
      <EmptyState
        scale="marketing"
        headline="No photographers match all three filters"
        description="Loosen one filter and results come back."
      />,
    );

    const heading = screen.getByRole('heading', {
      name: 'No photographers match all three filters',
    });

    expect(heading.className).toContain('text-display-empty');
    expect(heading.className).not.toContain('text-display-md');
    expect(screen.getByText('Loosen one filter and results come back.').className).toContain(
      'max-w-[520px]',
    );
  });

  it('keeps the in-app scale when none is asked for', () => {
    render(<EmptyState headline="No requests yet" description="Nothing has come in." />);

    const heading = screen.getByRole('heading', { name: 'No requests yet' });

    expect(heading.className).toContain('text-display-md');
    expect(heading.className).not.toContain('text-display-empty');
  });

  it('draws no panel by default', () => {
    const { container } = render(
      <EmptyState headline="No requests yet" description="Nothing has come in." />,
    );
    const root = container.querySelector('[data-slot="empty-state"]');

    expect(root?.className).toContain('px-6 py-12');
    expect(root?.className).not.toContain('border-dashed');
  });

  it('fills its column as a dashed 18px panel when `panel` is set', () => {
    const { container } = render(
      <EmptyState panel headline="No requests yet" description="Nothing has come in." />,
    );
    const root = container.querySelector('[data-slot="empty-state"]');

    // Frame `20`: 1px dashed stone-400 hairline, 18px radius, stone-0 ground,
    // filling the pane rather than sitting top-aligned in it.
    expect(root?.className).toContain('h-full');
    expect(root?.className).toContain('rounded-2xl');
    expect(root?.className).toContain('border-dashed');
    expect(root?.className).toContain('border-stone-400');
    expect(root?.className).toContain('bg-stone-0');
    expect(root?.className).toContain('px-10');
    expect(root?.className).not.toContain('py-12');
  });

  it('spaces the panel stack to frame 20’s 18 / 9 / 18 rhythm', () => {
    const { container } = render(
      <EmptyState
        panel
        icon={<EmptyStateGlyph />}
        headline="No requests yet"
        description="Nothing has come in."
        action={<button type="button">Preview my profile</button>}
      />,
    );
    const root = container.querySelector('[data-slot="empty-state"]');

    // The uniform 12px gap cannot express 18 / 9 / 18, so the panel drops it.
    expect(root?.className).toContain('gap-0');
    expect(root?.className).not.toContain('gap-3');
    expect(root?.querySelector('[aria-hidden="true"]')?.className).toContain('mb-[18px]');
    expect(root?.querySelector('h2')?.className).toContain('mb-2.25');
    expect(root?.querySelector('p')?.className).toContain('mb-[18px]');
  });

  it('keeps the even rhythm when it is not a panel', () => {
    const { container } = render(
      <EmptyState headline="No requests yet" description="Nothing has come in." />,
    );
    const root = container.querySelector('[data-slot="empty-state"]');

    expect(root?.className).toContain('gap-3');
    expect(root?.querySelector('h2')?.className).not.toContain('mb-2.25');
  });
});

describe('EmptyStateGlyph', () => {
  it('draws two 36px circles, one filled and one dashed, in a 58x36 box', () => {
    const { container } = render(<EmptyStateGlyph />);

    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.className).toContain('w-[58px]');
    expect(wrapper?.className).toContain('h-9');

    const circles = wrapper?.querySelectorAll('span') ?? [];
    expect(circles).toHaveLength(2);
    expect(circles[0]?.className).toContain('bg-stone-150');
    expect(circles[0]?.className).toContain('size-9');
    expect(circles[1]?.className).toContain('border-[1.5px]');
    expect(circles[1]?.className).toContain('border-dashed');
    expect(circles[1]?.className).toContain('border-stone-400');
    expect(circles[1]?.className).toContain('left-[22px]');
  });
});
