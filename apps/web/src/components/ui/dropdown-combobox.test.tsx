import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboboxDropdown } from './dropdown-combobox';
import { filterOptions } from '@/lib/option-filter';

/*
 * The **sheet** mount, which nothing else in the suite drives.
 *
 * `category-select.test.tsx` and `city-select.test.tsx` both stub `matchMedia`
 * to force the anchored popover, deliberately — the search bar is a desktop
 * surface first. That left the sheet's own wiring untested, and the sheet is
 * where this component differs most: the anchored field is behind a scrim and
 * cannot be typed into, so the input is rendered inside the panel instead.
 */
function matchMedia(anchored: boolean): typeof window.matchMedia {
  return ((query: string) =>
    ({
      matches: anchored && query.includes('min-width: 640px'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const OPTIONS = [
  { value: '', label: 'Any vendor type' },
  { value: 'photography', label: 'Photography' },
];

function renderCombobox(): void {
  render(
    <ComboboxDropdown
      options={OPTIONS}
      value=""
      onCommit={vi.fn()}
      committedLabel=""
      filter={filterOptions}
      openOnFocus
      label="Vendor type"
      id="vendor-type"
      placeholder="Any vendor type"
      emptyMessage="Nothing here."
      noMatchMessage={(query) => `No match for ${query}.`}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ComboboxDropdown — the sheet mount', () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(false);
  });

  /*
   * **One element per id, always.** The sheet renders the field inside its own
   * panel; rendering it in the trigger as well would put two elements under one
   * `id`, which breaks `<label htmlFor>`, `getElementById`, and therefore
   * `aria-activedescendant` — a screen reader would be pointed at whichever the
   * document found first.
   */
  it('never renders two elements carrying the field id', async () => {
    const user = userEvent.setup();
    renderCombobox();

    // Closed: the field lives in the panel, so nothing carries the id yet.
    expect(document.querySelectorAll('#vendor-type')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Vendor type' }));

    // Open: exactly one — the sheet's copy, and no second in the trigger.
    expect(document.querySelectorAll('#vendor-type')).toHaveLength(1);
    expect(await screen.findByRole('combobox', { name: 'Vendor type' })).toBeDefined();
  });

  /*
   * A `htmlFor` pointing at an element that is not in the document reads as
   * correct to anything checking that inputs have labels, which is worse than
   * no association at all.
   */
  it('leaves the label unassociated while the input is not rendered', () => {
    renderCombobox();

    const label = document.querySelector('label');
    expect(label?.getAttribute('for')).toBeNull();
  });

  it('shows a button rather than an input while the sheet is the mount', () => {
    renderCombobox();

    expect(screen.getByRole('button', { name: 'Vendor type' })).toBeDefined();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('ComboboxDropdown — the anchored mount', () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(true);
  });

  it('makes the field itself the combobox', () => {
    renderCombobox();

    expect(screen.getByRole('combobox', { name: 'Vendor type' })).toBeDefined();
    expect(document.querySelectorAll('#vendor-type')).toHaveLength(1);
  });
});
