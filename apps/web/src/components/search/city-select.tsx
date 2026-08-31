'use client';

import type { VendorCity } from '@vendor-marketplace/shared';
import { ComboboxDropdown } from '@/components/ui/dropdown-combobox';
import type { DropdownOption } from '@/components/ui/dropdown';
import { rankCityMatches } from '@/lib/option-filter';
import { cn } from '@/lib/utils';

/**
 * The city picker: a **typeahead** over the places that actually have vendors,
 * and **city and state always travel together**.
 *
 * The reasoning that made this a select is unchanged and is what the typeahead
 * is built to preserve. "Springfield" names a place in thirty-odd states and
 * "Portland" names two people would fly between, so a *typed* city cannot tell
 * a customer which one they asked for — and a typed city matching nothing
 * produced an empty grid with nothing to say about why. Both problems are
 * answered by **selection, not typing, being what commits**: every suggestion
 * names its state, every suggestion has somebody in it, and a string that
 * matches nothing commits neither half of the pair.
 *
 * **It does not open a list on focus, and that is the point (#375).** The
 * user's instruction was explicit: *"the city should literally be an input,
 * where the validated city appears as clickable for a user. Not a scrollable
 * dropdown for city since cities can vary drastically."* Suggestions appear
 * from the first character and not before. That is the one behavioural
 * difference from `Vendor type`, which opens on its full taxonomy.
 *
 * The old select could not produce a "we have nobody in that city" state at
 * all — it only offered places that existed. A typeahead can, so it must
 * answer it in copy rather than with a blank panel.
 */

const ANYWHERE_LABEL = 'Anywhere';

/**
 * At most eight suggestions render; the rest are counted.
 *
 * A typeahead that scrolls is the scroll list the user rejected. Eight is what
 * fits the 360px cap at the default row height without one.
 */
const MAX_SUGGESTIONS = 8;

/** `Austin|TX` — the pair as one option value, since neither half stands alone. */
function keyOf(city: string, state: string): string {
  return `${city}|${state}`;
}

export interface CitySelectProps {
  /** Every city with a published vendor, from `GET /vendors/cities`. */
  cities: readonly VendorCity[];
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
  cities,
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
   * The vendor count is a **row hint, not a suggestion**: it is a real query
   * result — how many published vendors are in that place — rather than a
   * platform statistic, which is what keeps it legal under the
   * no-invented-numbers rule. It is also the ranking's third tier, so it is
   * lifted into a map the ranker can read without re-deriving the pair key.
   */
  const counts = new Map(
    cities.map((place) => [keyOf(place.city, place.state), place.vendorCount]),
  );

  const options: DropdownOption[] = cities.map((place) => ({
    value: keyOf(place.city, place.state),
    label: `${place.city}, ${place.state}`,
    hint: `${place.vendorCount} ${place.vendorCount === 1 ? 'vendor' : 'vendors'}`,
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
      /*
       * Ranked, not merely filtered: exact prefix matches first, then
       * substrings, then by vendor count. That last tier is what puts
       * `Portland, OR` above `Portland, ME` — both are real and neither is
       * wrong, so the one more people can book leads.
       */
      filter={(all, query) => rankCityMatches(all, query, counts)}
      openOnFocus={false}
      /*
       * "Anywhere" is not a row here — the list is places that *have* vendors,
       * so there is nothing to pick. Clearing the text is the gesture, and it
       * commits the empty pair.
       */
      commitOnEmpty
      label="City"
      id={id}
      placeholder={ANYWHERE_LABEL}
      emptyMessage="No vendors have published a location yet."
      noMatchMessage={(query) => `No vendors in “${query}” yet. Try a nearby city.`}
      limit={MAX_SUGGESTIONS}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      scrim={isHero}
      className={cn('flex min-w-0 flex-col rounded-full text-left', className)}
      labelClassName={cn('cursor-text', labelClassName)}
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
