import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState, EmptyStateGlyph } from './empty-state';

afterEach(cleanup);

describe('EmptyState', () => {
  it('sets the sentence to the frame’s 420px measure', () => {
    render(<EmptyState headline="No requests yet" description="Nothing has come in." />);

    expect(screen.getByText('Nothing has come in.').className).toContain('max-w-[420px]');
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
    expect(circles[1]?.className).toContain('border-dashed');
    expect(circles[1]?.className).toContain('border-stone-400');
    expect(circles[1]?.className).toContain('left-[22px]');
  });
});
