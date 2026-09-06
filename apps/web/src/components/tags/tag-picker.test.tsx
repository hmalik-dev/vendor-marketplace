import { MAX_TAGS_PER_CATEGORY, type TagCategory } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireTag } from '@/lib/wire-schemas';

const suggestResponses: unknown[] = [];
const requestSpy = vi.fn();
const toastCalls: { level: string; message: string }[] = [];

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestSpy,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (message: string) => toastCalls.push({ level: 'success', message }),
    error: (message: string) => toastCalls.push({ level: 'error', message }),
    info: (message: string) => toastCalls.push({ level: 'info', message }),
  },
}));

const { TagPicker } = await import('./tag-picker');

function tag(name: string, category: TagCategory, order: number): WireTag {
  return {
    id: `${category}-${order}`,
    name,
    slug: `${category}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    category,
    displayOrder: order,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

const LANGUAGES = ['English', 'Spanish', 'French', 'Hindi', 'Urdu', 'Arabic'].map((name, index) =>
  tag(name, 'language', index + 1),
);
const CULTURAL = [tag('South Asian', 'cultural', 1), tag('Caribbean', 'cultural', 2)];
const DIETARY = [tag('Halal', 'dietary', 1), tag('Vegan', 'dietary', 2)];
const ALL_TAGS: WireTag[] = [...LANGUAGES, ...CULTURAL, ...DIETARY];

/** Renders the picker with selection state owned by the test, as in the form. */
function renderPicker(initial: string[] = []): { current: () => string[] } {
  const state = { ids: initial };
  const onTagsChange = vi.fn((ids: string[]) => {
    state.ids = ids;
    rerender(
      <TagPicker allTags={ALL_TAGS} selectedTagIds={state.ids} onTagsChange={onTagsChange} />,
    );
  });

  const { rerender } = render(
    <TagPicker allTags={ALL_TAGS} selectedTagIds={state.ids} onTagsChange={onTagsChange} />,
  );

  return { current: () => state.ids };
}

describe('TagPicker', () => {
  beforeEach(() => {
    suggestResponses.length = 0;
    toastCalls.length = 0;
    requestSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  /*
   * The exact set, not three lookups. #329 removed the `style` group ("How you
   * work"), and naming the survivors proves nothing about a fourth section
   * still rendering beside them — which is the shape the regression would take.
   */
  it('renders one section per tag category and no others', () => {
    renderPicker();

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Languages spoken', 'Cultural specialties', 'Dietary']);
  });

  /*
   * A placeholder is not an accessible name (#411): it is a fallback some
   * readers use and others ignore, and it disappears the moment the vendor
   * types. All three search boxes here carried nothing else, so all three read
   * as the same unnamed field.
   */
  it('names each category’s search box rather than leaving it to the placeholder', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('combobox', { name: 'Choose languages spoken' }));

    const search = await screen.findByLabelText('Search languages spoken');
    expect(search.getAttribute('placeholder')).toBe('Search languages spoken…');
    expect(search.getAttribute('data-slot')).toBe('command-input');
  });

  it('adds a tag as a removable pill when it is selected', async () => {
    const user = userEvent.setup();
    const picker = renderPicker();

    await user.click(screen.getByRole('combobox', { name: 'Choose languages spoken' }));
    await user.click(await screen.findByRole('option', { name: 'Spanish' }));

    expect(picker.current()).toEqual(['language-2']);
    expect(screen.getByRole('button', { name: 'Remove Spanish' })).toBeDefined();
  });

  it('removes the tag again when its pill is dismissed', async () => {
    const user = userEvent.setup();
    const picker = renderPicker(['language-2']);

    await user.click(screen.getByRole('button', { name: 'Remove Spanish' }));

    expect(picker.current()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Remove Spanish' })).toBeNull();
  });

  it('filters the options as the vendor searches', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('combobox', { name: 'Choose languages spoken' }));
    await user.type(await screen.findByPlaceholderText('Search languages spoken…'), 'span');

    expect(await screen.findByRole('option', { name: 'Spanish' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'French' })).toBeNull();
  });

  it(`disables the remaining options at ${MAX_TAGS_PER_CATEGORY} tags in a category`, async () => {
    const user = userEvent.setup();
    const atLimit = LANGUAGES.slice(0, MAX_TAGS_PER_CATEGORY).map((languageTag) => languageTag.id);
    renderPicker(atLimit);

    expect(
      screen.getByText(`${MAX_TAGS_PER_CATEGORY} of ${MAX_TAGS_PER_CATEGORY} (limit reached)`),
    ).toBeDefined();

    await user.click(screen.getByRole('combobox', { name: 'Choose languages spoken' }));
    const remaining = await screen.findByRole('option', { name: /Arabic/ });

    expect(remaining.getAttribute('aria-disabled')).toBe('true');
  });

  it('leaves the other categories selectable when one is at its limit', async () => {
    const user = userEvent.setup();
    const atLimit = LANGUAGES.slice(0, MAX_TAGS_PER_CATEGORY).map((languageTag) => languageTag.id);
    const picker = renderPicker(atLimit);

    await user.click(screen.getByRole('combobox', { name: 'Choose dietary' }));
    await user.click(await screen.findByRole('option', { name: 'Halal' }));

    expect(picker.current()).toContain('dietary-1');
  });
});

describe('TagSuggestionForm within the picker', () => {
  beforeEach(() => {
    toastCalls.length = 0;
    requestSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  async function openSuggestionForm(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    const languageSection = screen
      .getByRole('heading', { name: 'Languages spoken' })
      .closest('section');
    expect(languageSection).not.toBeNull();

    await user.click(
      within(languageSection as HTMLElement).getByRole('button', { name: "Don't see yours?" }),
    );
    return user;
  }

  /*
   * The picker is rendered inside the profile form. HTML has no nested forms,
   * so a <form> here is dropped by the browser and its submit button submits
   * the profile instead — which navigated the page away mid-suggestion.
   */
  it('renders no nested form element', async () => {
    render(
      <form data-testid="outer">
        <TagPicker allTags={ALL_TAGS} selectedTagIds={[]} onTagsChange={vi.fn()} />
      </form>,
    );
    await openSuggestionForm();

    const outer = screen.getByTestId('outer');
    expect(outer.querySelector('form')).toBeNull();
  });

  it('keeps the submit control out of the surrounding form', async () => {
    render(
      <form data-testid="outer">
        <TagPicker allTags={ALL_TAGS} selectedTagIds={[]} onTagsChange={vi.fn()} />
      </form>,
    );
    await openSuggestionForm();

    expect(screen.getByRole('button', { name: 'Submit for review' }).getAttribute('type')).toBe(
      'button',
    );
  });

  it('resolves a duplicate against the loaded list without calling the API', async () => {
    const picker = renderPicker();
    const user = await openSuggestionForm();

    await user.type(screen.getByLabelText('Suggest a language'), '  spanish ');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(requestSpy).not.toHaveBeenCalled();
    expect(picker.current()).toEqual(['language-2']);
    expect(toastCalls[0]?.message).toMatch(/already available/i);
  });

  it('submits a genuinely new tag for review', async () => {
    requestSpy.mockResolvedValue({ status: 'submitted', suggestionId: 'id' });
    renderPicker();
    const user = await openSuggestionForm();

    await user.type(screen.getByLabelText('Suggest a language'), 'Amharic');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(requestSpy).toHaveBeenCalledWith(
      '/tags/suggest',
      expect.objectContaining({
        method: 'POST',
        body: { suggestedName: 'Amharic', category: 'language' },
      }),
    );
    expect(toastCalls.at(-1)?.message).toMatch(/submitted for review/i);
  });

  it('selects the tag the server matched when the client list was stale', async () => {
    const serverTag = tag('Amharic', 'language', 24);
    requestSpy.mockResolvedValue({ status: 'exists', tag: serverTag });
    const picker = renderPicker();
    const user = await openSuggestionForm();

    await user.type(screen.getByLabelText('Suggest a language'), 'Amharic');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(picker.current()).toEqual([serverTag.id]);
    expect(toastCalls.at(-1)?.message).toMatch(/already available/i);
  });

  it('reports a suggestion that is already awaiting review', async () => {
    requestSpy.mockResolvedValue({ status: 'already_suggested' });
    renderPicker();
    const user = await openSuggestionForm();

    await user.type(screen.getByLabelText('Suggest a language'), 'Amharic');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(toastCalls.at(-1)).toEqual({
      level: 'info',
      message: 'Already submitted for review.',
    });
  });

  /*
   * #405. At the per-category ceiling the picker refuses the selection and says
   * so, but this form announced "we've selected X for you" over the top of it —
   * two toasts contradicting each other, with the tag not selected.
   */
  describe('at the per-category limit', () => {
    const FULL = LANGUAGES.slice(0, MAX_TAGS_PER_CATEGORY).map((row) => row.id);

    it('does not claim a duplicate from the loaded list was selected', async () => {
      const picker = renderPicker([...FULL]);
      const user = await openSuggestionForm();
      const spare = LANGUAGES[MAX_TAGS_PER_CATEGORY]!;

      await user.type(screen.getByLabelText('Suggest a language'), spare.name);
      await user.click(screen.getByRole('button', { name: 'Submit for review' }));

      expect(picker.current()).toEqual(FULL);
      expect(toastCalls.map((call) => call.message)).not.toContain(
        `Already available — we've selected ${spare.name} for you.`,
      );
      expect(toastCalls.at(-1)?.level).toBe('error');
      expect(toastCalls.at(-1)?.message).toMatch(/at most/i);
    });

    it('does not claim a tag the server matched was selected', async () => {
      const serverTag = tag('Amharic', 'language', 24);
      requestSpy.mockResolvedValue({ status: 'exists', tag: serverTag });
      const picker = renderPicker([...FULL]);
      const user = await openSuggestionForm();

      await user.type(screen.getByLabelText('Suggest a language'), 'Amharic');
      await user.click(screen.getByRole('button', { name: 'Submit for review' }));

      expect(picker.current()).toEqual(FULL);
      expect(toastCalls.map((call) => call.message)).not.toContain(
        `Already available — we've selected ${serverTag.name} for you.`,
      );
      expect(toastCalls.at(-1)?.level).toBe('error');
    });

    it('leaves the suggestion panel open so the vendor can make room', async () => {
      renderPicker([...FULL]);
      const user = await openSuggestionForm();

      await user.type(
        screen.getByLabelText('Suggest a language'),
        LANGUAGES[MAX_TAGS_PER_CATEGORY]!.name,
      );
      await user.click(screen.getByRole('button', { name: 'Submit for review' }));

      expect(screen.getByLabelText('Suggest a language')).toBeDefined();
    });
  });

  /*
   * #405. A tag an admin approved *after* this page loaded is not in `allTags`,
   * and everything downstream resolves a held id through that list — the
   * per-category count, the "n of 5" line, and the pills. So a suggestion the
   * server matched to one was selected but invisible: it counted as zero, drew
   * no pill and therefore no Remove button, and let the vendor go on to pick a
   * full five more with no warning.
   *
   * That became severe with the rest of this ticket. The storefront save is now
   * one transaction, so the over-limit selection the API then refuses stops the
   * *whole* save — bio, business name and all — against a tag the vendor cannot
   * see to remove, on every retry, until a reload throws the edit away.
   */
  describe('a tag the server matched but this page has never seen', () => {
    const SERVER_TAG = tag('Amharic', 'language', 24);

    async function suggestIt(initial: string[] = []): Promise<{ current: () => string[] }> {
      requestSpy.mockResolvedValue({ status: 'exists', tag: SERVER_TAG });
      const picker = renderPicker(initial);
      const user = await openSuggestionForm();

      await user.type(screen.getByLabelText('Suggest a language'), SERVER_TAG.name);
      await user.click(screen.getByRole('button', { name: 'Submit for review' }));

      return picker;
    }

    it('selects it', async () => {
      const picker = await suggestIt();

      expect(picker.current()).toEqual([SERVER_TAG.id]);
    });

    it('shows it as a removable pill rather than holding it invisibly', async () => {
      await suggestIt();

      expect(screen.getByRole('button', { name: `Remove ${SERVER_TAG.name}` })).toBeDefined();
    });

    it('counts it against its category', async () => {
      await suggestIt();

      expect(screen.getByText(`1 of ${MAX_TAGS_PER_CATEGORY}`)).toBeDefined();
    });

    /*
     * The consequence that mattered: it used to count as zero, so the vendor
     * could reach `MAX_TAGS_PER_CATEGORY + 1` with no refusal anywhere on
     * screen and only find out when the whole storefront save was rejected.
     */
    it('takes the category to its ceiling, and says so', async () => {
      const user = userEvent.setup();
      const picker = await suggestIt(
        LANGUAGES.slice(0, MAX_TAGS_PER_CATEGORY - 1).map((row) => row.id),
      );
      expect(picker.current()).toHaveLength(MAX_TAGS_PER_CATEGORY);

      // Counted as zero before, so this line read "4 of 5" and the remaining
      // options stayed live — the vendor's only warning arrived as a rejected
      // storefront save.
      expect(
        screen.getByText(`${MAX_TAGS_PER_CATEGORY} of ${MAX_TAGS_PER_CATEGORY} (limit reached)`),
      ).toBeDefined();

      await user.click(screen.getByRole('combobox', { name: 'Choose languages spoken' }));
      const remaining = await screen.findByRole('option', { name: /Arabic/ });

      expect(remaining.getAttribute('aria-disabled')).toBe('true');
      expect(picker.current()).toHaveLength(MAX_TAGS_PER_CATEGORY);
    });

    it('leaves the other categories alone', async () => {
      const user = userEvent.setup();
      const picker = await suggestIt();

      await user.click(screen.getByRole('combobox', { name: 'Choose dietary' }));
      await user.click(await screen.findByRole('option', { name: 'Halal' }));

      expect(picker.current()).toContain('dietary-1');
    });
  });
});
