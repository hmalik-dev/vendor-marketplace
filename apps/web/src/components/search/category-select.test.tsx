import type { Category } from '@vendor-marketplace/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategorySelect } from './category-select';

function category(id: string, name: string, order: number): Category {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\W+/g, '-'),
    description: `${name} vendors.`,
    icon: 'camera',
    displayOrder: order,
    isActive: true,
  };
}

const CATEGORIES: Category[] = [
  category('1', 'Photography', 1),
  category('2', 'Videography', 2),
  category('3', 'Catering', 3),
  category('4', 'Florals', 4),
];

function renderSelect(value = ''): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(
    <CategorySelect
      categories={CATEGORIES}
      value={value}
      onChange={onChange}
      size="compact"
      id="vendor-type"
    />,
  );
  return { onChange };
}

const trigger = (): HTMLElement => screen.getByLabelText('Vendor type');

describe('CategorySelect', () => {
  it('shows the selected category, not a free-text value', () => {
    renderSelect('photography');

    expect(trigger().textContent).toContain('Photography');
  });

  it('reads "Any vendor type" when nothing is chosen', () => {
    renderSelect('');

    expect(trigger().textContent).toContain('Any vendor type');
  });

  it('resolves to a category slug when one is picked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: 'Catering' }));

    expect(onChange).toHaveBeenCalledWith('catering');
  });

  it('filters the list as the customer types', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(await screen.findByPlaceholderText('Filter vendor types'), 'cater');

    expect(await screen.findByRole('option', { name: 'Catering' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Photography' })).toBeNull();
  });

  /*
   * The regression this file exists for. An always-present "Any vendor type"
   * row kept cmdk's list non-empty, so the no-match state never rendered and a
   * customer who typed a phrase saw a list holding nothing but "Any". The field
   * cannot hold what they typed, so it owes them the category they meant.
   */
  it('offers the closest categories for a phrase it cannot hold', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(
      await screen.findByPlaceholderText('Filter vendor types'),
      'wedding photographer near me',
    );

    expect(await screen.findByText('No matching type')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Photography' })).toBeDefined();
    // "Any vendor type" is not an answer to "which type did you mean?".
    expect(screen.queryByRole('option', { name: 'Any vendor type' })).toBeNull();
  });

  it('selects a suggested category from the no-match state', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await user.type(await screen.findByPlaceholderText('Filter vendor types'), 'photograpy');
    await user.click(await screen.findByRole('button', { name: 'Photography' }));

    expect(onChange).toHaveBeenCalledWith('photography');
  });

  it('says so plainly when nothing is even close', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(await screen.findByPlaceholderText('Filter vendor types'), 'zzzzzzzz');

    expect(await screen.findByText('No matching type')).toBeDefined();
    expect(screen.getByText('Pick a vendor type from the list to search.')).toBeDefined();
  });

  it('discards what was typed when the popover closes without a choice', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await user.type(await screen.findByPlaceholderText('Filter vendor types'), 'cater');
    await user.keyboard('{Escape}');

    // The field still holds the resolved category, never the typed string.
    await waitFor(() => {
      expect(trigger().textContent).toContain('Photography');
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
