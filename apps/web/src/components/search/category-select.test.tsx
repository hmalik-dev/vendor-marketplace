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
  /*
   * The reason matching is substring rather than prefix: "film" has to find
   * this, and a prefix match never would. Named to avoid colliding with the
   * `Photo & film` short description that renders as Photography's row hint —
   * two nodes carrying the same text is a test failure about the fixture
   * rather than about the filter.
   */
  category('5', 'Wedding films', 5),
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

/**
 * The field itself. A `combobox` input since #375, not a `button` — so this
 * reads `.value`, and every assertion that used to read `.textContent` had to
 * move with it.
 */
const trigger = (): HTMLInputElement =>
  screen.getByRole('combobox', { name: 'Vendor type' }) as HTMLInputElement;

describe('CategorySelect', () => {
  it('shows the selected category, not a free-text value', () => {
    renderSelect('photography');

    expect(trigger().value).toBe('Photography');
  });

  /*
   * The placeholder, not the value. The distinction matters: an empty field
   * that *contains* the words "Any vendor type" would filter against them the
   * moment the customer typed a character, and the list would come back empty.
   */
  it('reads "Any vendor type" when nothing is chosen', () => {
    renderSelect('');

    expect(trigger().value).toBe('');
    expect(trigger().placeholder).toBe('Any vendor type');
  });

  it('resolves to a category slug when one is picked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));

    expect(onChange).toHaveBeenCalledWith('catering');
  });

  /*
   * **What replaced "offers no filter field" (#375).**
   *
   * That assertion was right for its time and is now inverted: the field *is*
   * the input. What it was really protecting is not the absence of a textbox —
   * it is that a panel must never contain a **second, autofocused** field,
   * which is D13 ruling 1's actual objection ("its focus ring would appear
   * every single time the panel opened — permanent decoration, not feedback").
   * That still holds, so it is what this asserts. The old wording would have
   * banned the control the user asked for.
   */
  it('puts no second field inside the panel — the trigger is the only input', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    const panel = await screen.findByRole('listbox');

    expect(screen.queryByPlaceholderText('Filter vendor types')).toBeNull();
    expect(panel.querySelector('input')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  /*
   * Filtering, not the jump-to-first-letter this list shipped with.
   * `42-dropdowns.md:45` has specified "typing narrows the list in place (not a
   * jump-to-first-letter)" since the 2026-08-30 import; D14 recorded that the
   * code was still on the behaviour that import reversed.
   *
   * Asserted on **rendered rows**, not on internal state — a filter that
   * narrows a variable while the panel still draws eleven rows is the failure
   * this is written against.
   */
  it('narrows the list to what was typed, matching a substring anywhere', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(trigger(), 'film');

    const rows = await screen.findAllByRole('option');
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Wedding films')]);
  });

  /*
   * Two names sharing a substring must both survive — "a category name that is
   * a substring of another" is one of the ticket's edge cases, and a filter
   * that collapsed them would silently hide a real choice.
   */
  it('keeps every category a substring matches, not just the first', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(trigger(), 'graph');

    const rows = await screen.findAllByRole('option');
    expect(rows.map((row) => row.textContent?.replace(/ vendors\.$/, ''))).toEqual([
      expect.stringContaining('Photography'),
      expect.stringContaining('Videography'),
    ]);
  });

  it('names what was typed when nothing matches, rather than drawing a blank panel', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.type(trigger(), 'zzzz');

    expect(await screen.findByText(/zzzz/)).toBeDefined();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  /*
   * The invariant the whole ticket turns on: **typing is an input affordance,
   * never a query term**. A customer who types a misspelling and walks away has
   * selected nothing, and the field says so by reverting.
   */
  it('commits nothing on blur, and reverts to the committed label', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await user.clear(trigger());
    await user.type(trigger(), 'cater');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(trigger().value).toBe('Photography');
  });

  it('commits the slug when a row is chosen, not the typed text', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await user.type(trigger(), 'cater');
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('catering');
  });

  it('opens on the full list, because the taxonomy is worth seeing', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());

    // Every fixture plus the `Any vendor type` row that empties the field.
    expect(await screen.findAllByRole('option')).toHaveLength(CATEGORIES.length + 1);
  });

  /*
   * `ArrowDown` must not move the caret. In a text input the browser's own
   * default sends it to the end of the value, which would put the caret past
   * the word the customer is still editing.
   */
  it('moves the active option with the arrows without moving the caret', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    const field = trigger();
    await user.click(field);
    await user.type(field, 'ph');
    field.setSelectionRange(1, 1);

    await user.keyboard('{ArrowDown}');

    /*
     * Read before the commit. `Enter` reverts the field to the committed
     * label, which moves the caret for a legitimate reason — asserting after
     * it would be measuring the revert rather than the arrow.
     */
    expect(field.selectionStart).toBe(1);

    /*
     * `videography`, not `photography` — and that is the point rather than an
     * accident. "ph" is a substring of *both* names ("photography" and
     * "video**graph**y"), so both survive the filter and `ArrowDown` moves from
     * the first to the second. A prefix filter would have left one row here and
     * the arrow would have had nowhere to go.
     */
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('videography');
  });

  it('carries aria-activedescendant to a row that exists', async () => {
    const user = userEvent.setup();
    renderSelect('');

    const field = trigger();
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-activedescendant')).toBeNull();

    await user.click(field);
    await screen.findByRole('listbox');

    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-autocomplete')).toBe('list');

    const activeId = field.getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId as string)).not.toBeNull();
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

  it('reverts the typed text and closes on Escape', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await user.clear(trigger());
    await user.type(trigger(), 'cater');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    // Both halves: the panel closes *and* the field goes back to what was
    // committed. A revert that left the typed text would show a value the
    // query does not carry.
    expect(trigger().value).toBe('Photography');
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
  it('tints the field while it holds focus, so the segment is identifiable', () => {
    render(
      <CategorySelect categories={CATEGORIES} value="" onChange={vi.fn()} id="type" size="hero" />,
    );

    /*
     * `has-[:focus-visible]`, not `focus-visible`. Since #375 the focus lands
     * on the input **inside** the segment rather than on the segment itself, so
     * the treatment reads one level out — the same way `search-bar.tsx`'s
     * `segment` does it for City and Event date.
     */
    const field = screen.getByRole('combobox', { name: 'Vendor type' }).parentElement;
    expect(field?.className).toContain('has-[:focus-visible]:bg-clay-400/10');
    expect(field?.className).toContain('has-[:focus-visible]:inset-ring-2');
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

    /*
     * The value is the input itself since #375 — no span to walk. What this
     * guards is unchanged and is the reason it survived the rewrite rather
     * than being deleted with the span: **the two branches must never both be
     * emitted.** `font-semibold` beside the ladder's `lg:font-normal` is two
     * equal-specificity utilities, and at 1440 the responsive one wins on
     * source order, so the browser paints 400 while the class list reads
     * semibold. Asserting the *absence* of the loser is the only form of this
     * check that fails when the bug is present.
     */
    const field = screen.getByRole('combobox', { name: 'Vendor type' });

    expect(field.className).toContain('font-medium');
    expect(field.className).toContain('lg:font-normal');
    expect(field.className).not.toContain('font-semibold');

    await user.click(field);

    await waitFor(() => expect(field.getAttribute('aria-expanded')).toBe('true'));

    expect(field.className).toContain('font-semibold');
    expect(field.className).toContain('text-clay-600');
    // The layering that silently won at 1440 — never emitted alongside the win.
    expect(field.className).not.toContain('lg:font-normal');
  });
});
