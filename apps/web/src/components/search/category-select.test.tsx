import type { Category } from '@vendor-marketplace/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategorySelect } from './category-select';

/*
 * This control lives in the search bar, which is a desktop surface first, so
 * the suite drives the **anchored** mount. jsdom's stub in `vitest.setup.ts`
 * answers every media query "no", which would silently put every one of these
 * assertions against the bottom sheet instead — a different mount with
 * different rows, tested by accident. `dropdown.test.tsx` drives the sheet on
 * purpose.
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
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));

    expect(onChange).toHaveBeenCalledWith('catering');
  });

  /*
   * The filter field is gone (#167), and the "did you mean" recovery went with
   * it — that existed only to answer a typo in a field that no longer accepts
   * typing. `42-dropdowns.md` deletes both, and says why: eleven categories fit
   * on one screen, and a filter box on a list that short is friction rather
   * than help. Asserted as ABSENT rather than simply untested, because it
   * shipped for months and a test that merely stopped mentioning it would let
   * it back in.
   */
  it('offers no filter field, and no did-you-mean state to go with it', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await screen.findByRole('listbox');

    expect(screen.queryByPlaceholderText('Filter vendor types')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('No matching type')).toBeNull();
  });

  /* Type-ahead does in one keystroke what the filter field took a phrase to
     do — the keyboard model in `42-dropdowns.md`. */
  it('jumps to the first category matching a typed letter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await screen.findByRole('listbox');
    await user.keyboard('c{Enter}');

    expect(onChange).toHaveBeenCalledWith('catering');
  });

  it('moves with the arrows and commits with Enter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await screen.findByRole('listbox');
    // From "Any vendor type" at the top, two rows down is Videography.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('videography');
  });

  it('closes on Escape without changing the value', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger().textContent).toContain('Photography');
    expect(onChange).not.toHaveBeenCalled();
  });

  /* The frame prints each category's own one-line description under its name. */
  it('carries each category’s short description', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());

    expect(await screen.findByText('Photo & film')).toBeDefined();
  });
  /*
   * #89. The vendor-type trigger is the third segment of the search bar, and
   * like the other two it now tints while it holds focus. Without it the
   * bar's halo was the only focus signal and said nothing about which
   * segment was active.
   */
  it('tints the trigger while it holds focus, so the segment is identifiable', () => {
    render(
      <CategorySelect categories={CATEGORIES} value="" onChange={vi.fn()} id="type" size="hero" />,
    );

    expect(screen.getByRole('button', { name: 'Vendor type' }).className).toContain(
      'focus-visible:bg-clay-400/10',
    );
  });

  /*
   * The open state the caret used to carry (D25) — and the reason this asserts
   * an **absence** as well as a presence.
   *
   * The first fix added `font-semibold` beside a size ladder that already read
   * `lg:font-normal`. Both are equal-specificity utilities, so at 1440 the `lg:`
   * variant won on source order: the browser measured weight 400 open and
   * closed while the class list read `font-semibold`. `cn` does not save this —
   * tailwind-merge only collapses conflicts it is doing the joining for, and a
   * responsive variant is not a conflict it resolves. So the resting weight is
   * composed into the closed branch instead of layered under the open one, and
   * the check is that the losing class is not emitted at all.
   */
  it('turns the hero value clay and semibold while its panel is open', async () => {
    const user = userEvent.setup();
    render(
      <CategorySelect categories={CATEGORIES} value="" onChange={vi.fn()} id="type" size="hero" />,
    );

    const button = screen.getByRole('button', { name: 'Vendor type' });
    /*
     * Scoped to the trigger. Once the panel is open the same words are also a
     * row inside it, so an unscoped query matches two elements — and the one
     * this is about is the one in the button.
     */
    const value = (): HTMLElement =>
      [...button.querySelectorAll('span')]
        .reverse()
        .find((span) => span.textContent === 'Any vendor type') as HTMLElement;

    expect(value().className).toContain('font-medium');
    expect(value().className).toContain('lg:font-normal');
    expect(value().className).not.toContain('font-semibold');

    await user.click(button);

    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('true'));

    expect(value().className).toContain('font-semibold');
    expect(value().className).toContain('text-clay-600');
    // The layering that silently won at 1440 — never emitted alongside the win.
    expect(value().className).not.toContain('lg:font-normal');
  });
});
