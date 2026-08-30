'use client';

import type { VendorCity } from '@vendor-marketplace/shared';
import { useState } from 'react';
import type { DropdownOption } from '@/components/ui/dropdown';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { cn } from '@/lib/utils';

/**
 * The city picker: a select over the places that actually have vendors, and
 * **city and state always travel together**.
 *
 * This was a free-text box, and the two problems with that were the same
 * problem. "Springfield" names a place in thirty-odd states and "Portland"
 * names two people would fly between, so a typed city could not tell a customer
 * which one they had asked for — and a typed city that matched nothing produced
 * an empty grid with nothing to say about why. A select over real places
 * answers both: every option names its state, and every option has somebody in
 * it.
 *
 * The same constraint the vendor-type field carries, for the same reason: the
 * query can only ask a question the platform can answer.
 */
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

const ANYWHERE_LABEL = 'Anywhere';

/** `Austin|TX` — the pair as one option value, since neither half stands alone. */
function keyOf(city: string, state: string): string {
  return `${city}|${state}`;
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
  const [isOpen, setIsOpen] = useState(false);
  const isHero = size === 'hero';
  const chosen = city === '' ? null : keyOf(city, state);

  /*
   * "Anywhere" leads, because it is how the field is emptied. Each city carries
   * its vendor count as the row's hint — a real query result, not a platform
   * statistic, and the one fact that tells a customer whether a place is worth
   * choosing before they choose it.
   */
  const options: DropdownOption[] = [
    { value: '', label: ANYWHERE_LABEL },
    ...cities.map((place) => ({
      value: keyOf(place.city, place.state),
      label: `${place.city}, ${place.state}`,
      hint: `${place.vendorCount} ${place.vendorCount === 1 ? 'vendor' : 'vendors'}`,
    })),
  ];

  return (
    <SingleSelectDropdown
      open={isOpen}
      onOpenChange={setIsOpen}
      label="City"
      countNoun="cities"
      options={options}
      value={chosen}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      scrim={isHero}
      emptyMessage="No vendors have published a location yet."
      onChange={(next) => {
        const [nextCity = '', nextState = ''] = next.split('|');
        onChange({ city: nextCity, state: nextState });
      }}
      trigger={
        <button
          type="button"
          id={id}
          aria-label="City"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn('flex min-w-0 flex-col rounded-full text-left outline-none', className)}
        >
          <span className={labelClassName}>City</span>
          <span
            className={cn('flex items-center justify-between gap-2', isHero ? 'pr-2.5' : 'pr-2.5')}
          >
            <span
              className={cn(
                'truncate',
                valueClassName,
                city === '' ? 'text-stone-600' : 'text-stone-900',
              )}
            >
              {city === '' ? ANYWHERE_LABEL : `${city}, ${state}`}
            </span>
            <span
              aria-hidden="true"
              className={cn('shrink-0 text-[9px]', isOpen ? 'text-clay-400' : 'text-stone-600')}
            >
              {isOpen ? '▴' : '▾'}
            </span>
          </span>
        </button>
      }
    />
  );
}
