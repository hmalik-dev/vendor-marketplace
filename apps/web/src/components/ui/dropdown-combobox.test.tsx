import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboboxDropdown, type ComboboxDropdownProps } from './dropdown-combobox';
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

function renderCombobox(props: Partial<ComboboxDropdownProps> = {}): void {
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
      {...props}
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

/*
 * `onQueryChange` and `busy` exist for one caller — `City`, which since #384
 * fetches its own options as the customer types rather than being handed them
 * up front. They are asserted here rather than only through that field because
 * this is where the contract is: a field that is told what was typed, and told
 * when the typing has stopped.
 */
describe('ComboboxDropdown — reporting the typed text', () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(true);
  });

  it('reports each change, so an async field can fetch what was typed', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    renderCombobox({ onQueryChange });

    await user.type(screen.getByRole('combobox', { name: 'Vendor type' }), 'pho');

    expect(onQueryChange.mock.calls.map(([query]) => query)).toEqual(['p', 'ph', 'pho']);
  });

  /*
   * The field is showing its committed value again, so there is no query. An
   * owner not told that is left holding the last word typed — a second state
   * indistinguishable from the first by looking at the field.
   */
  it('reports the empty string once the field reverts', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    renderCombobox({ onQueryChange });

    await user.type(screen.getByRole('combobox', { name: 'Vendor type' }), 'pho');
    onQueryChange.mockClear();
    await user.keyboard('{Escape}');

    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('shows the caller\u2019s status copy rather than claiming no match', async () => {
    const user = userEvent.setup();
    // No options and a status line — the state an async field is in before its
    // first answer, and again when that answer never came.
    renderCombobox({ options: [], statusMessage: 'Searching\u2026' });

    await user.type(screen.getByRole('combobox', { name: 'Vendor type' }), 'pho');

    expect(await screen.findByText('Searching\u2026')).toBeDefined();
    expect(screen.queryByText('No match for pho.')).toBeNull();
  });

  it('falls back to the no-match copy once there is no status to report', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: [], statusMessage: undefined });

    await user.type(screen.getByRole('combobox', { name: 'Vendor type' }), 'pho');

    expect(await screen.findByText('No match for pho.')).toBeDefined();
  });

  /*
   * `42-dropdowns.md`: an empty body is copy **plus a single action**, never
   * copy alone. Wired to `commit('')` rather than to a caller's `onClick`, so
   * it reverts the typed text and closes the panel the way choosing a row
   * does — the three things a bare handler would each have to redo.
   */
  it('commits the empty value through the action under an empty panel', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    renderCombobox({ options: [], onCommit, emptyActionLabel: 'Search anywhere' });
    const field = screen.getByRole('combobox', { name: 'Vendor type' });

    await user.type(field, 'pho');
    await user.click(await screen.findByRole('button', { name: 'Search anywhere' }));

    expect(onCommit).toHaveBeenCalledWith('');
    expect(field).toHaveProperty('value', '');
    expect(field.getAttribute('aria-expanded')).toBe('false');
  });

  /*
   * `Tab` closes the panel by design (`42-dropdowns.md`), so nothing would ever
   * land on the action — it was mouse-only until ArrowDown reached it, and
   * `04-laws.md` does not allow a control the keyboard cannot get to.
   */
  it('reaches the action with ArrowDown when there are no rows to move through', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    renderCombobox({ options: [], onCommit, emptyActionLabel: 'Search anywhere' });
    const field = screen.getByRole('combobox', { name: 'Vendor type' });

    await user.type(field, 'pho');
    await screen.findByRole('button', { name: 'Search anywhere' });
    await user.keyboard('{ArrowDown}');

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Search anywhere' }));

    // And it commits from there, which is what makes it an action rather than
    // a focus stop.
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith('');
  });

  /*
   * `42-dropdowns.md`: "Focus returns to the field on close." Closing from
   * *inside* the panel is the case that had no owner — `commit` covers the row
   * path, and Radix's own `Escape` handler is a native document listener whose
   * close hands focus back to nothing in anchor mode. Measured in a browser
   * before the fix: `document.activeElement` was `<body>`, twice.
   */
  it('returns focus to the field when the panel closes with focus inside it', async () => {
    const user = userEvent.setup();
    /*
     * `openOnFocus: false` — `City`'s configuration, and the only caller that
     * has an empty-panel action for focus to be inside. On a field that *does*
     * open on focus, handing focus back legitimately reopens the panel; that is
     * that prop's own behaviour, not this one's, so asserting it here would be
     * asserting two rules at once.
     */
    renderCombobox({ options: [], openOnFocus: false, emptyActionLabel: 'Search anywhere' });
    const field = screen.getByRole('combobox', { name: 'Vendor type' });

    await user.type(field, 'pho');
    await screen.findByRole('button', { name: 'Search anywhere' });
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Search anywhere' }));

    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves ArrowDown alone when there are rows to move through', async () => {
    const user = userEvent.setup();
    renderCombobox({ emptyActionLabel: 'Search anywhere' });
    const field = screen.getByRole('combobox', { name: 'Vendor type' });

    await user.click(field);
    await user.keyboard('{ArrowDown}');

    // Still in the field, moving the active descendant — the action is only
    // the ArrowDown target when the list has nothing in it.
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('aria-activedescendant')).not.toBeNull();
  });

  it('draws no action where the caller offers none', async () => {
    const user = userEvent.setup();
    renderCombobox({ options: [] });

    await user.type(screen.getByRole('combobox', { name: 'Vendor type' }), 'pho');

    await screen.findByText('No match for pho.');
    expect(screen.queryByRole('button', { name: 'Search anywhere' })).toBeNull();
  });

  it('caps the input where the caller gives it a length', async () => {
    renderCombobox({ maxLength: 100 });

    expect(screen.getByRole('combobox', { name: 'Vendor type' }).getAttribute('maxlength')).toBe(
      '100',
    );
  });
});
