'use client';

import { MAX_NAME_LENGTH, PLACE_SUGGESTION_LIMIT } from '@vendor-marketplace/shared';
import { useState } from 'react';
import { ComboboxDropdown } from '@/components/ui/dropdown-combobox';
import type { DropdownOption } from '@/components/ui/dropdown';
import { filterOptions } from '@/lib/option-filter';
import { usePlaceSuggestions } from '@/lib/use-place-suggestions';
import { cn } from '@/lib/utils';

/**
 * The city picker: **a place search over every US city**, and city and state
 * always travel together.
 *
 * ## What #384 overruled, and what it did not
 *
 * This field used to be a typeahead over *the places that already had
 * vendors*, preloaded whole, each row labelled with how many were there. The
 * user overruled all three of those in one instruction, verbatim:
 *
 * > *"i currently want the city dropdown to function the way airbnb's 'where'
 * > input functions. Do not preload and indicate how many vendors are in each
 * > city.. users should be able to search for any city and see the results."*
 *
 * So: nothing is fetched until a character is typed, suggestions come from
 * `GET /places` — US reference data that touches no vendor row — and no count
 * appears on a row or in the ordering. `Springfield, IL` is offered and commits
 * whether or not anybody has published there.
 *
 * **#375's closing invariant is half kept and half overruled**, and the halves
 * matter. Overruled: *"a free-text city that reaches the API as a filter is a
 * regression"* is now the requirement — but only for a city that **exists**.
 * Kept, unchanged: **selection is what commits, typing never is.** A bare
 * `Enter` on `Sprngfield` still commits nothing, because `lower(city) = $1`
 * matches exactly and a typo would return an empty grid with nothing to say
 * about why. Airbnb behaves the same way; typing is an affordance, picking is
 * an answer.
 *
 * The reasoning the old design carried was not wrong — a picker offering
 * somewhere with nobody in it *does* guarantee an empty result. What changed is
 * the answer to that: an empty result is now a designed screen. Frame `18`'s
 * no-results state names the city and offers relaxations, which is a better
 * answer than making the place unpickable and telling the customer nothing.
 *
 * **It does not open a list on focus, and that is still the point (#375).** The
 * user's earlier instruction was equally explicit: *"the city should literally
 * be an input, where the validated city appears as clickable for a user. Not a
 * scrollable dropdown for city since cities can vary drastically."* Suggestions
 * appear from the first character and not before — which is now also what makes
 * "do not preload" true, since the first character is what triggers the request.
 */

const ANYWHERE_LABEL = 'Anywhere';

/** `Austin|TX` — the pair as one option value, since neither half stands alone. */
function keyOf(city: string, state: string): string {
  return `${city}|${state}`;
}

export interface CitySelectProps {
  city: string;
  state: string;
  onChange: (next: { city: string; state: string }) => void;
  size: 'compact' | 'hero';
  id: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function CitySelect({
  city,
  state,
  onChange,
  size,
  id,
  className,
  labelClassName,
  valueClassName,
}: CitySelectProps): React.ReactElement {
  const isHero = size === 'hero';
  /*
   * The typed text, mirrored out of the combobox rather than owned here. The
   * combobox still owns the field's own state — what is displayed, what is
   * committed, what reverts on blur — and this is only what the request is
   * keyed on.
   */
  const [typed, setTyped] = useState('');
  const { suggestions, busy, failed } = usePlaceSuggestions(typed);

  const options: DropdownOption[] = suggestions.map((place) => ({
    value: keyOf(place.city, place.state),
    label: `${place.city}, ${place.state}`,
  }));

  return (
    <ComboboxDropdown
      options={options}
      value={city === '' ? '' : keyOf(city, state)}
      onCommit={(next) => {
        /*
         * Clearing the field to empty commits `Anywhere`. The pair goes back to
         * `('', '')` together — a city with no state, or the reverse, is the
         * state this control exists to make unrepresentable.
         */
        const [nextCity = '', nextState = ''] = next.split('|');
        onChange({ city: nextCity, state: nextState });
      }}
      committedLabel={city === '' ? '' : `${city}, ${state}`}
      onQueryChange={setTyped}
      /*
       * **Matching is checked here; ranking is not done here.** The two are
       * different jobs and only one of them can live on the client.
       *
       * `GET /places` returns the eight best matches for the typed text —
       * prefix before substring, more populous before less — and a client
       * cannot re-rank what it was not sent, since `population` never crosses
       * the wire. So the order that arrives is the order that renders.
       *
       * But the hook deliberately holds the **previous** query's rows while the
       * next one loads, so the panel does not flash empty between two matching
       * words — and without this filter those stale rows stayed committable.
       * Typing `santa`, then ` fe` before the request landed, and pressing
       * `Enter` committed **Santa Ana, CA**: a city the customer neither typed
       * nor chose, inside the 180ms debounce that every normal typist crosses.
       * Making the options async is what broke the combobox's own invariant
       * that its rows are matches for what is typed; `filterOptions` restores
       * it, and costs nothing when the answer is current, because every row the
       * API returns contains the needle in its `City, ST` label by
       * construction.
       */
      filter={filterOptions}
      openOnFocus={false}
      /*
       * "Anywhere" is not a row here — the panel shows what was typed, and
       * there is nothing to type that means everywhere. Clearing the text is
       * the gesture, and it commits the empty pair.
       */
      commitOnEmpty
      label="City"
      id={id}
      placeholder={ANYWHERE_LABEL}
      /*
       * Reachable only if the panel opens with nothing typed, which the sheet
       * mount does. It is a prompt, not a failure — `40-states.md` does not let
       * one borrow the other's copy — and since #384 the prompt is honest about
       * the field's new scope: any US city, not the ones we happen to serve.
       */
      emptyMessage="Start typing a city."
      promptMessage="Start typing a city — anywhere in the US."
      /*
       * Three empty panels and only one of them is a no-match. A request in
       * flight has not answered yet; a request that failed cannot answer at
       * all, and saying `No US city matches “portl”` there would accuse the
       * customer of a typo on a place with eight matches (`40-states.md`).
       */
      statusMessage={
        busy
          ? 'Searching…'
          : failed
            ? "We can't reach city search right now. Try again in a moment."
            : undefined
      }
      noMatchMessage={(query) => `No US city matches “${query}”.`}
      /*
       * The single action `42-dropdowns.md` requires under an empty panel, and
       * the only one this field has to offer: drop the filter and search
       * everywhere. It is what `Anywhere` means, and it is the escape from both
       * a typo and an unreachable API. Suppressed while a request is in flight,
       * where there is nothing yet to escape from.
       */
      emptyActionLabel={busy ? undefined : 'Search anywhere'}
      limit={PLACE_SUGGESTION_LIMIT}
      /*
       * What is typed is sent as `?q=`, which `placeSearchQuerySchema` caps at
       * the same constant. Capping the field is what stops a long paste
       * becoming a 400 the customer has to read about.
       */
      maxLength={MAX_NAME_LENGTH}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      scrim={isHero}
      /*
        No radius of its own: `search-bar.tsx`'s `segment` supplies it, and it is
        two values now (`max-sm:rounded-sm sm:rounded-full` — see the comment
        there). A local `rounded-full` beside them was a second, unqualified
        declaration racing the first on source order, which is the shape of bug
        `web-design-parity.md` calls a class-list claim the browser disagrees
        with.
      */
      className={cn('flex min-w-0 flex-col text-left', className)}
      labelClassName={labelClassName}
      inputClassName={(open) =>
        cn(
          'w-full min-w-0 truncate bg-transparent outline-none placeholder:text-stone-600',
          valueClassName,
          /*
            Open state, resolved in JS. See `dropdown-combobox.tsx` — a class
            string carrying both branches loses to source order at `lg`, which
            is the bug #373 measured on this very field.
          */
          open ? 'font-semibold text-clay-600' : city === '' ? 'text-stone-600' : 'text-stone-900',
        )
      }
    />
  );
}
