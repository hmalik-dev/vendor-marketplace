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
 * different rows, tested by accident.
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
  category('4', 'Decor', 4),
];

function renderSelect(
  value = '',
  size: 'compact' | 'hero' = 'compact',
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(
    <CategorySelect
      categories={CATEGORIES}
      value={value}
      onChange={onChange}
      size={size}
      id="vendor-type"
    />,
  );
  return { onChange };
}

/**
 * The field itself. **A `button`, not a `combobox` (VEN-603)** — the trigger
 * has no text input of its own any more, so there is nothing to read `.value`
 * from and nothing an OS keyboard could ever be summoned by.
 */
const trigger = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Vendor type' }) as HTMLButtonElement;

const valueText = (): string | null =>
  trigger().querySelector('[data-slot="category-value"]')?.textContent ?? null;

describe('CategorySelect', () => {
  it('shows the selected category, not a free-text value', () => {
    renderSelect('photography');

    expect(valueText()).toBe('Photography');
  });

  it('reads "Any vendor type" when nothing is chosen', () => {
    renderSelect('');

    expect(valueText()).toBe('Any vendor type');
  });

  /**
   * **The whole point of VEN-603.** No `<input>` exists anywhere in this
   * control, at rest or open — so there is no field an OS virtual keyboard
   * could ever be summoned by, on mobile or anywhere else. This is what
   * makes every `inputMode`/keyboard-suppression mechanism unnecessary here.
   */
  it('renders no text input anywhere, open or closed', async () => {
    const user = userEvent.setup();
    renderSelect('');

    expect(document.querySelector('input')).toBeNull();

    await user.click(trigger());
    await screen.findByRole('listbox');

    expect(document.querySelector('input')).toBeNull();
  });

  it('resolves to a category slug when a row is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));

    expect(onChange).toHaveBeenCalledWith('catering');
  });

  it('resolves to the empty string when "Any vendor type" is chosen', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: 'Any vendor type' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('opens on the full list, "Any vendor type" leading', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());

    const rows = await screen.findAllByRole('option');
    expect(rows).toHaveLength(CATEGORIES.length + 1);
    expect(rows[0]?.textContent).toContain('Any vendor type');
  });

  /*
   * `categories.length`, never `options.length` — the caption is the real
   * taxonomy count, and the extra "Any vendor type" row is not a category. A
   * caption reading `options.length` would say "5 categories" for 4 real
   * ones, which is exactly the kind of invented-looking number
   * `web-design-parity.md`'s "no invented numbers" law exists to catch.
   */
  it('captions the real category count, not the option count', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());

    expect(await screen.findByText(`Vendor type · ${CATEGORIES.length} categories`)).toBeDefined();
  });

  it('closes the panel once a row is committed', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /^Photography/ }));

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('returns focus to the trigger once the panel closes', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));

    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('reopens on a click after a previous commit', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /^Catering/ }));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  /*
   * `DropdownList`'s own keyboard model — arrows move, `Enter` commits — with
   * no typing filter in front of it. `Vendor type` no longer needs one
   * (VEN-603): eleven categories fit one screen, unlike `City`'s open-ended
   * set of US places, which keeps its typing combobox untouched.
   */
  it('moves the active option with the arrows and commits with Enter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('');

    await user.click(trigger());
    await screen.findByRole('listbox');
    // From "Any vendor type" at the top: down once to Photography, once more
    // to Videography.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('videography');
  });

  it('opens with the committed row already active', async () => {
    const user = userEvent.setup();
    renderSelect('decor');

    await user.click(trigger());
    const list = await screen.findByRole('listbox');

    const activeId = list.getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId as string)?.textContent).toContain('Decor');
  });

  it('closes without committing on Escape', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('photography');

    await user.click(trigger());
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
    expect(valueText()).toBe('Photography');
  });

  it('carries each category’s short description', async () => {
    const user = userEvent.setup();
    renderSelect('');

    await user.click(trigger());

    expect(await screen.findByText('Photo & film')).toBeDefined();
  });

  /*
   * #89, restated for a self-focused trigger. `SEGMENT_FOCUS`'s
   * `has-[:focus-visible]` variant targets a focusable *child* — the shape
   * `City` and `DateDropdown` both have — but this button is its own
   * focusable element, so the fill has to be declared directly too, the same
   * way `search-bar.tsx`'s `segment` does it for `DateDropdown`'s
   * identically-shaped trigger.
   */
  it('fills the field while it holds focus, so the segment is identifiable', () => {
    renderSelect('');

    expect(trigger().className).toContain('focus-visible:bg-stone-200');
    expect(trigger().className).toContain('group/segment');
    expect(trigger().getAttribute('data-focus-own')).not.toBeNull();
    expect(trigger().getAttribute('data-focus-fill')).not.toBeNull();
  });

  /*
   * VEN-541: a fill alone is 1.19:1, short of the 3:1 floor — the ring is
   * what actually meets it. The old input-child shape carried this via
   * `SEGMENT_FOCUS`'s `has-[:focus-visible]` variant; the button is its own
   * focused element now, so it needs the direct variant declared too, or the
   * indicator regresses silently.
   */
  it('carries the VEN-541 ring alongside the fill, not the fill alone', () => {
    renderSelect('');

    expect(trigger().className).toContain('focus-visible:ring-2');
    expect(trigger().className).toContain('focus-visible:ring-inset');
    expect(trigger().className).toContain('focus-visible:ring-clay-400');
  });
});

/*
 * The disclosure caret — #426, which reverses D25 for this control and for no
 * other. Frames `01 Landing` and `02 Search` both draw `▾` on the vendor-type
 * segment and `28 Dropdown open — hero` draws `▴` on the open one.
 *
 * `app/dropdown-caret.test.ts` is the other half of this: it holds the override
 * everywhere else and proves this file is the only exemption.
 */
describe('CategorySelect — the disclosure caret (#426)', () => {
  const caret = (): HTMLElement => {
    /*
     * A leaf span, not merely one whose concatenated `textContent` contains
     * the glyph — the value is a real `<span>` now (VEN-603, no longer an
     * `<input>` whose value doesn't contribute to a parent's `textContent`),
     * so the row wrapping both the value and the caret matches the regex too
     * unless this is scoped to elements with no element children of their own.
     */
    const found = [...trigger().querySelectorAll('span')].filter(
      (span) => span.children.length === 0 && /^[▾▴]$/.test(span.textContent ?? ''),
    );

    expect(found).toHaveLength(1);

    return found[0] as HTMLElement;
  };

  it('draws `▾` beside the value when the panel is closed', () => {
    renderSelect('photography');

    expect(caret().textContent).toBe('▾');
  });

  it('flips to `▴` while the panel is open, and back when it closes', async () => {
    const user = userEvent.setup();
    renderSelect('photography');

    expect(caret().textContent).toBe('▾');

    await user.click(trigger());
    await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('true'));

    expect(caret().textContent).toBe('▴');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('false'));

    expect(caret().textContent).toBe('▾');
  });

  /*
   * D25 found two chips announcing "All categories black down-pointing small
   * triangle, button" because the glyph sat in a template literal inside the
   * control. The caret is `aria-hidden`, so the accessible name is the label
   * and nothing else, in both states.
   */
  it('is hidden from assistive technology and never part of the accessible name', async () => {
    const user = userEvent.setup();
    renderSelect('photography');

    expect(caret().getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Vendor type' })).toBe(trigger());

    await user.click(trigger());
    await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('true'));

    // Still exactly `Vendor type` — a name carrying `▾` would not match this.
    expect(screen.getByRole('button', { name: 'Vendor type' })).toBe(trigger());
    expect(caret().getAttribute('aria-hidden')).toBe('true');
  });

  /*
   * **Both signals, which is #426's recorded ruling.** `42-dropdowns.md`
   * states the open state as "the value turning clay and the caret
   * flipping", and frame `28` draws both.
   */
  it('turns clay with the value when open, and is stone-600 at rest', async () => {
    const user = userEvent.setup();
    // Hero: `font-medium`/`lg:font-normal` are the hero-only resting weight.
    renderSelect('photography', 'hero');

    expect(caret().className).toContain('text-stone-600');
    expect(caret().className).not.toContain('text-clay-600');

    const value = () => trigger().querySelector('[data-slot="category-value"]') as HTMLElement;
    expect(value().className).toContain('font-medium');
    expect(value().className).not.toContain('font-semibold');

    await user.click(trigger());
    await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('true'));

    expect(caret().className).toContain('text-clay-600');
    expect(caret().className).not.toContain('text-stone-600');
    // The other half of the pair — kept, not traded away.
    expect(value().className).toContain('font-semibold');
    expect(value().className).toContain('text-clay-600');
  });

  it('carries the compact bar’s 9px, per frame `02`', () => {
    renderSelect('photography');

    const classes = caret().className.split(/\s+/);
    expect(classes).toContain('text-[9px]');
    expect(classes).not.toContain('lg:text-[10px]');
  });

  it('carries the hero ladder — 11 / 9 / 10 / 11 across the four widths', () => {
    renderSelect('photography', 'hero');

    const classes = caret().className.split(/\s+/);
    expect(classes).toContain('text-[11px]');
    expect(classes).toContain('sm:text-[9px]');
    expect(classes).toContain('lg:text-[10px]');
    expect(classes).toContain('min-[90rem]:text-[11px]');
  });
});
