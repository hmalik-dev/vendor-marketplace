import type { VendorCity } from '@vendor-marketplace/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CitySelect } from './city-select';

/*
 * The search bar is a desktop surface first, so this suite drives the
 * **anchored** mount. jsdom's stub in `vitest.setup.ts` answers every media
 * query "no", which would silently put every assertion against the bottom sheet
 * instead — a different mount with a different focus owner, tested by accident.
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

/*
 * Two Portlands on purpose. `city-select.tsx`'s own reasoning is that
 * "Portland" names two places people would fly between, and the pair is what
 * tells them apart — so the fixture has to contain the ambiguity the control
 * exists to resolve. `San José` carries the diacritic for the same reason.
 */
const CITIES: VendorCity[] = [
  { city: 'Austin', state: 'TX', vendorCount: 11 },
  { city: 'Portland', state: 'OR', vendorCount: 7 },
  { city: 'Portland', state: 'ME', vendorCount: 2 },
  { city: 'San José', state: 'CA', vendorCount: 4 },
  { city: 'Boston', state: 'MA', vendorCount: 3 },
];

function renderSelect(city = '', state = ''): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(
    <CitySelect
      cities={CITIES}
      city={city}
      state={state}
      onChange={onChange}
      size="compact"
      id="city"
    />,
  );
  return { onChange };
}

const field = (): HTMLInputElement =>
  screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;

describe('CitySelect', () => {
  /*
   * **The assertion that pins the user's distinction between the two fields.**
   *
   * `Vendor type` opens on its full taxonomy; `City` does not open at all until
   * something is typed. The instruction was explicit — "Not a scrollable
   * dropdown for city since cities can vary drastically" — so a later refactor
   * that quietly made the two fields the same would be undoing the ticket.
   */
  it('opens no list on focus', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(field());

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('suggests from the first character typed, with the real vendor count', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'aus');

    const option = await screen.findByRole('option', { name: /Austin, TX/ });
    expect(option.textContent).toContain('11 vendors');
  });

  it('commits the pair when a suggestion is chosen', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'aus');
    await user.click(await screen.findByRole('option', { name: /Austin, TX/ }));

    expect(onChange).toHaveBeenCalledWith({ city: 'Austin', state: 'TX' });
  });

  /*
   * The invariant. A typed string that matches nothing commits **neither half**
   * — which is what keeps a free-text city out of the query, and the reason the
   * select existed before the typeahead did.
   */
  it('commits nothing when the typed text matches no suggestion', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'Nowheresville');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('');
  });

  it('renders both same-named cities, each naming its state', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'portl');

    const rows = await screen.findAllByRole('option');
    /*
     * Ranked by vendor count within the tier, so Oregon leads Maine. Both are
     * real places and neither is wrong — the one more people can actually book
     * comes first.
     */
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Portland, OR'),
      expect.stringContaining('Portland, ME'),
    ]);
  });

  it('matches across the diacritic, in both directions', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'san jose');
    expect(await screen.findByRole('option', { name: /San José/ })).toBeDefined();

    await user.clear(field());
    await user.type(field(), 'josé');
    expect(await screen.findByRole('option', { name: /San José/ })).toBeDefined();
  });

  /* The state code is the only way a customer distinguishes two Portlands by
     typing, so the comma has to reach the matcher. */
  it('matches the state code when the typed text carries a comma', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'portland, me');

    const rows = await screen.findAllByRole('option');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('Portland, ME');
  });

  it('names what was typed when nothing matches, rather than drawing a blank panel', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'Atlantis');

    expect(await screen.findByText(/Atlantis/)).toBeDefined();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows the committed pair, and reverts to it after uncommitted typing', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('Austin', 'TX');

    expect(field().value).toBe('Austin, TX');

    /*
     * Appended, not cleared-then-typed. Clearing is its own gesture and its own
     * test below — it *commits* the empty pair, so using it here would be
     * asserting "commits nothing" against the one keystroke that does.
     */
    await user.type(field(), 'x');
    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('Austin, TX');
  });

  /*
   * A committed city whose last vendor unpublishes leaves the list but not the
   * field. Blanking it mid-session because the *list* changed would be a lie
   * about what the customer asked for.
   */
  it('keeps rendering a committed city that has left the list', () => {
    render(
      <CitySelect
        cities={CITIES}
        city="Marfa"
        state="TX"
        onChange={vi.fn()}
        size="compact"
        id="city"
      />,
    );

    expect((screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement).value).toBe(
      'Marfa, TX',
    );
  });

  /*
   * The list can be `[]` on a healthy page — `getVendorCities` degrades to an
   * empty array when the API is down, deliberately. Typing against it must say
   * so rather than appearing to hang or claiming a match.
   */
  it('answers in copy when the list is empty rather than showing nothing', async () => {
    const user = userEvent.setup();
    render(<CitySelect cities={[]} city="" state="" onChange={vi.fn()} size="compact" id="city" />);

    await user.type(screen.getByRole('combobox', { name: 'City' }), 'aus');

    expect(await screen.findByText(/aus/)).toBeDefined();
  });

  /*
   * "Anywhere" is not a row in this list — the list is places that *have*
   * vendors — so clearing the text is the only gesture that means "drop this
   * filter". It has to commit rather than revert, or a customer who deleted
   * their city and walked away would find it still filtering their results.
   */
  it('commits the empty pair when the field is cleared', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('Austin', 'TX');

    await user.clear(field());

    expect(onChange).toHaveBeenCalledWith({ city: '', state: '' });
  });

  it('carries the combobox roles and a live active descendant', async () => {
    const user = userEvent.setup();
    renderSelect();

    expect(field().getAttribute('aria-autocomplete')).toBe('list');
    expect(field().getAttribute('aria-haspopup')).toBe('listbox');

    await user.type(field(), 'aus');
    await waitFor(() => expect(field().getAttribute('aria-expanded')).toBe('true'));

    const activeId = field().getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId as string)?.getAttribute('role')).toBe('option');
  });
});
