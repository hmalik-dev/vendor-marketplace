import type { PlaceSuggestion } from '@vendor-marketplace/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CitySelect } from './city-select';

/*
 * The suggestion source, faked at the one boundary that matters: the HTTP call.
 * Everything above it — the debounce, the abort, the cache, the panel — is the
 * code under test, and mocking any of that would be testing the mock.
 */
const apiRequest = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
  ApiClientError: class extends Error {},
  ApiTimeoutError: class extends Error {},
}));

/*
 * Two Portlands on purpose. `city-select.tsx`'s own reasoning is that
 * "Portland" names two places people would fly between, and the pair is what
 * tells them apart — so the fixture has to contain the ambiguity the control
 * exists to resolve. `San José` carries the diacritic for the same reason, and
 * `Springfield, IL` is the place #384 exists for: no vendor is there and it is
 * suggested anyway.
 */
const PLACES: PlaceSuggestion[] = [
  { city: 'Austin', state: 'TX' },
  { city: 'Portland', state: 'OR' },
  { city: 'Portland', state: 'ME' },
  { city: 'San José', state: 'CA' },
  { city: 'Springfield', state: 'IL' },
];

/**
 * Stands in for `GET /places`, prefix-matching the way the DAO does.
 *
 * Ranking is **not** re-implemented here: the API returns rows already ordered,
 * and the component's contract is that it renders them in the order given. A
 * fake that sorted would be asserting the fake's ranking, not the field's
 * fidelity to the server's.
 */
function answerWith(places: readonly PlaceSuggestion[] = PLACES): void {
  apiRequest.mockImplementation((path: string) => {
    const needle = decodeURIComponent(new URL(path, 'http://x').searchParams.get('q') ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

    return Promise.resolve(
      places.filter((place) =>
        `${place.city}, ${place.state}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .includes(needle),
      ),
    );
  });
}

/*
 * The search bar is a desktop surface first, so this suite drives the
 * **anchored** mount. jsdom's stub in `vitest.setup.ts` answers every media
 * query "no", which would silently put every assertion against the bottom sheet
 * instead — a different mount with a different focus owner, tested by accident.
 */
beforeEach(() => {
  apiRequest.mockReset();
  answerWith();

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

function renderSelect(city = '', state = ''): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(<CitySelect city={city} state={state} onChange={onChange} size="compact" id="city" />);
  return { onChange };
}

const field = (): HTMLInputElement =>
  screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;

describe('CitySelect', () => {
  /*
   * **The assertion that pins the user's instruction not to preload.**
   *
   * The field is in the site header, so it renders on every route — a list
   * fetched on mount would be a request per page view for data nobody asked
   * for, which is the shape #384 was filed to remove. It is only a request once
   * there is something to search.
   */
  it('asks for nothing until a character is typed, and asks once it is', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(field());
    expect(apiRequest).not.toHaveBeenCalled();

    await user.type(field(), 'aus');

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    // Every call is a search for what has been typed so far — never a bare
    // `/places`, which is the preloaded list under a new name.
    for (const [path] of apiRequest.mock.calls) {
      expect(path).toMatch(/^\/places\?q=aus?$|^\/places\?q=a$/);
    }
    await waitFor(() =>
      expect(apiRequest).toHaveBeenLastCalledWith('/places?q=aus', expect.anything()),
    );
  });

  it('debounces a typed word into one request rather than one per letter', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'austin');
    await screen.findByRole('option', { name: /Austin, TX/ });

    // Six characters, and the field is allowed to ask about at most a couple of
    // the prefixes — never one per keystroke.
    expect(apiRequest.mock.calls.length).toBeLessThan(4);
  });

  /*
   * **The assertion that pins the user's instruction about vendor counts.**
   *
   * The rows used to read "11 vendors". They must not read anything of the
   * kind now, and the number is gone from the wire as well as the screen.
   */
  it('renders a suggestion as the place alone, with no count of anything', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'aus');

    const option = await screen.findByRole('option', { name: /Austin, TX/ });
    expect(option.textContent).toBe('Austin, TX');
    expect(option.textContent).not.toMatch(/\d/);
  });

  /*
   * **The assertion that pins the ticket's headline requirement.** No vendor
   * exists anywhere in this test, and `Springfield, IL` is offered and commits.
   */
  it('suggests and commits a city with no vendors in it', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'springf');
    await user.click(await screen.findByRole('option', { name: /Springfield, IL/ }));

    expect(onChange).toHaveBeenCalledWith({ city: 'Springfield', state: 'IL' });
  });

  /*
   * `Vendor type` opens on its full taxonomy; `City` does not open at all until
   * something is typed. The instruction was explicit — "Not a scrollable
   * dropdown for city since cities can vary drastically" — and since #384 it is
   * also what makes "do not preload" true, because typing is what asks.
   */
  it('opens no list on focus', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(field());

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('commits the pair when a suggestion is chosen', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'aus');
    await user.click(await screen.findByRole('option', { name: /Austin, TX/ }));

    expect(onChange).toHaveBeenCalledWith({ city: 'Austin', state: 'TX' });
  });

  /*
   * **The half of #375's invariant that survives #384.** A free-typed city may
   * now reach the API — but only one that exists, because `lower(city) = $1`
   * matches exactly and a typo would return an empty grid with nothing to say
   * about why. Selection commits; typing never does. Airbnb behaves the same.
   */
  it('commits nothing when the typed text matches no suggestion', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'Nowheresville');
    await user.keyboard('{Enter}');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe('');
  });

  /*
   * **The stale-commit defect, and it needed no unusual gesture.** The hook
   * holds the previous query's rows while the next one loads, so the panel does
   * not flash empty between two matching words. That left those rows
   * *committable*: typing `santa`, then ` fe` inside the 180ms debounce, then
   * `Enter` committed **Santa Ana, CA** — a city the customer neither typed nor
   * chose, which is the invariant this control exists to hold.
   *
   * Making the options async is what broke it: the combobox's rows stopped
   * being a function of what is typed. The client-side `filterOptions` restores
   * that, and costs nothing when the answer is current.
   */
  it('never commits a row left over from an earlier query', async () => {
    const user = userEvent.setup();
    let release: ((value: PlaceSuggestion[]) => void) | undefined;

    apiRequest
      .mockImplementationOnce(() => Promise.resolve([{ city: 'Santa Ana', state: 'CA' }]))
      // The second query never answers, so the panel is still showing the
      // first one's rows when `Enter` arrives.
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));

    const { onChange } = renderSelect();

    await user.type(field(), 'santa');
    await screen.findByRole('option', { name: /Santa Ana, CA/ });

    await user.type(field(), ' fe');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));

    // `Santa Ana, CA` does not match `santa fe`, so there is nothing to commit.
    expect(screen.queryByRole('option', { name: /Santa Ana/ })).toBeNull();
    await user.keyboard('{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    release?.([]);
  });

  it('keeps rows that still match while the next answer is on its way', async () => {
    const user = userEvent.setup();

    apiRequest
      .mockImplementationOnce(() => Promise.resolve([{ city: 'Austin', state: 'TX' }]))
      .mockImplementationOnce(() => new Promise(() => {}));

    renderSelect();

    await user.type(field(), 'aus');
    await screen.findByRole('option', { name: /Austin, TX/ });
    await user.type(field(), 'tin');

    // The other half of the trade: `Austin, TX` still matches `austin`, so it
    // stays on screen rather than the panel flashing empty mid-word.
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('option', { name: /Austin, TX/ })).toBeDefined();
  });

  it('renders both same-named cities in the order the API ranked them', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'portl');

    const rows = await screen.findAllByRole('option');
    /*
     * Oregon before Maine because the API sorts by population — the tie-break
     * #384 ruled in place of vendor count. The field's own job is to render the
     * order it was given rather than re-deriving one, which it cannot do: it
     * was never sent the number the order is built on.
     */
    expect(rows.map((row) => row.textContent)).toEqual(['Portland, OR', 'Portland, ME']);
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

  it('names what was typed when nothing matches, rather than drawing a blank panel', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.type(field(), 'Atlantis');

    expect(await screen.findByText('No US city matches “Atlantis”.')).toBeDefined();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  /*
   * The pending state is its own state. Before the debounce fires there is no
   * answer yet, and saying "no US city matches" then would be accusing the
   * customer of a typo on the first letter of every word they type.
   */
  it('says it is searching rather than accusing the customer of a typo', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(() => new Promise(() => {}));
    renderSelect();

    await user.type(field(), 'aus');

    expect(await screen.findByText('Searching…')).toBeDefined();
    expect(screen.queryByText(/No US city matches/)).toBeNull();
  });

  /*
   * A slow request for `aus` must not land after a fast one for `austin` and
   * repaint the older rows under the newer word. The hook aborts, so the late
   * answer never arrives at all.
   */
  it('does not let a slow earlier answer overwrite a newer one', async () => {
    const user = userEvent.setup();
    let releaseFirst: ((value: PlaceSuggestion[]) => void) | undefined;

    apiRequest.mockImplementationOnce(
      (_path: string, options: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          releaseFirst = resolve;
          options.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    renderSelect();

    await user.type(field(), 'aus');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));

    await user.type(field(), 'tin');
    const rows = await screen.findAllByRole('option');
    expect(rows.map((row) => row.textContent)).toEqual(['Austin, TX']);

    releaseFirst?.([{ city: 'Somewhere Else', state: 'CA' }]);

    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Somewhere Else/ })).toBeNull(),
    );
  });

  /*
   * **A failure is not a no-match, and must not borrow its copy.** Saying
   * `No US city matches "portl"` while the API is refusing every request tells
   * a customer they mistyped a place with eight matches — `40-states.md` does
   * not allow it, and the two states are indistinguishable from an empty array
   * alone, which is why the hook reports `failed` separately.
   */
  it('says it cannot reach city search, rather than blaming what was typed', async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(new Error('upstream is down'));
    const { onChange } = renderSelect();

    await user.type(field(), 'portl');

    expect(
      await screen.findByText('We can’t reach city search right now. Try again in a moment.'),
    ).toBeDefined();
    expect(screen.queryByText(/No US city matches/)).toBeNull();
    // Never a blank box and never a thrown error — and the query is untouched,
    // because an API that cannot suggest still must not change what was asked.
    expect(onChange).not.toHaveBeenCalled();
  });

  /*
   * `42-dropdowns.md`: an empty body is one row of copy **plus a single
   * action**. This field has exactly one to offer — drop the filter — and it
   * is the escape from both a typo and an API that cannot answer.
   */
  it('offers the one escape an empty panel has, and commits Anywhere through it', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();

    await user.type(field(), 'Atlantis');
    await screen.findByText('No US city matches “Atlantis”.');
    await user.click(screen.getByRole('button', { name: 'Search anywhere' }));

    expect(onChange).toHaveBeenCalledWith({ city: '', state: '' });
    // Through the commit path, not around it: the typed text is gone, the
    // panel is closed, and focus is back in the field.
    expect(field().value).toBe('');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(field());
  });

  it('offers no escape while the answer is still on its way', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(() => new Promise(() => {}));
    renderSelect();

    await user.type(field(), 'aus');

    await screen.findByText('Searching…');
    // Nothing to escape from yet — the panel is waiting, not stuck.
    expect(screen.queryByRole('button', { name: 'Search anywhere' })).toBeNull();
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
   * A committed city is a value the customer chose, not a row in a list that
   * happens to be loaded. Since #384 the field holds no list at all between
   * keystrokes, so this is the assertion that the committed label survives it.
   */
  it('keeps rendering a committed city with no suggestions loaded', () => {
    render(<CitySelect city="Marfa" state="TX" onChange={vi.fn()} size="compact" id="city" />);

    expect((screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement).value).toBe(
      'Marfa, TX',
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  /*
   * "Anywhere" is not a row a customer can pick — the panel shows what was
   * typed — so clearing the text is the only gesture that means "drop this
   * filter". It has to commit rather than revert, or a customer who deleted
   * their city and walked away would find it still filtering their results.
   */
  it('commits the empty pair when the field is cleared', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect('Austin', 'TX');

    await user.clear(field());

    expect(onChange).toHaveBeenCalledWith({ city: '', state: '' });
  });

  /*
   * The sheet mount opens on a tap whether or not the field suggests on focus,
   * so this state is reachable with nothing typed. It is a prompt, not a
   * failure — `40-states.md` does not let one borrow the other's copy — and its
   * words have to describe the field's new scope rather than the inventory's.
   */
  it('prompts for any US city rather than describing what we happen to stock', () => {
    render(<CitySelect city="" state="" onChange={vi.fn()} size="compact" id="city-sheet" />);

    expect(screen.queryByText('No vendors have published a location yet.')).toBeNull();
  });

  /*
   * `web-route-boundaries.md`: what is typed here is sent as `?q=`, and
   * `placeSearchQuerySchema` caps that at 100 characters. Without the cap on
   * the field a long paste becomes a 400 the customer has to read about,
   * instead of validation that never let it happen.
   */
  it('caps what can be typed at the length the API accepts', () => {
    renderSelect();

    expect(field().getAttribute('maxlength')).toBe('100');
  });

  it('carries the combobox roles and a live active descendant', async () => {
    const user = userEvent.setup();
    renderSelect();

    expect(field().getAttribute('aria-autocomplete')).toBe('list');
    expect(field().getAttribute('aria-haspopup')).toBe('listbox');

    await user.type(field(), 'aus');
    await screen.findByRole('option', { name: /Austin, TX/ });
    await waitFor(() => expect(field().getAttribute('aria-expanded')).toBe('true'));

    const activeId = field().getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId as string)?.getAttribute('role')).toBe('option');
  });
});
