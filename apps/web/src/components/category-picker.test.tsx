import type { Category } from '@vendor-marketplace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryPicker, MAX_CATEGORIES } from './category-picker';

function category(id: string, name: string, icon: string): Category {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\W+/g, '-'),
    description: `${name} vendors.`,
    icon,
    displayOrder: 1,
    isActive: true,
  };
}

const CATEGORIES: Category[] = [
  category('a', 'Photography', 'camera'),
  category('b', 'DJ/Music', 'music'),
  category('c', 'Catering', 'utensils'),
];

describe('CategoryPicker', () => {
  it('renders every category as a chip with its icon, not bare text', () => {
    const { container } = render(
      <CategoryPicker categories={CATEGORIES} selectedCategoryIds={[]} onChange={vi.fn()} />,
    );

    for (const item of CATEGORIES) {
      expect(screen.getByRole('button', { name: item.name })).toBeDefined();
    }
    expect(container.querySelectorAll('svg')).toHaveLength(CATEGORIES.length);
  });

  it('marks the selected chips as pressed', () => {
    render(
      <CategoryPicker categories={CATEGORIES} selectedCategoryIds={['b']} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'DJ/Music' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Photography' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('adds a category on click', async () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker categories={CATEGORIES} selectedCategoryIds={['a']} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Catering' }));

    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('removes an already-selected category on click', async () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATEGORIES}
        selectedCategoryIds={['a', 'c']}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Photography' }));

    expect(onChange).toHaveBeenCalledWith(['c']);
  });

  it('disables the unchosen chips once the limit is reached', () => {
    const many = Array.from({ length: MAX_CATEGORIES + 1 }, (_unused, index) =>
      category(`id-${index}`, `Category ${index}`, 'camera'),
    );
    const selected = many.slice(0, MAX_CATEGORIES).map((item) => item.id);

    render(<CategoryPicker categories={many} selectedCategoryIds={selected} onChange={vi.fn()} />);

    const overflow = screen.getByRole('button', { name: `Category ${MAX_CATEGORIES}` });
    expect(overflow.hasAttribute('disabled')).toBe(true);

    // A selected chip stays clickable so the vendor can swap one out.
    expect(screen.getByRole('button', { name: 'Category 0' }).hasAttribute('disabled')).toBe(false);
  });

  it('reports progress toward the limit', () => {
    render(
      <CategoryPicker
        categories={CATEGORIES}
        selectedCategoryIds={['a', 'b']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(`2 of ${MAX_CATEGORIES} chosen.`)).toBeDefined();
  });

  it('ignores clicks entirely while disabled', async () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        categories={CATEGORIES}
        selectedCategoryIds={[]}
        onChange={onChange}
        disabled
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Photography' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
