'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { BOOKING_SORTS, type BookingSort, type BookingTab } from '@/lib/booking-entries';

/** The frame draws the glyph inside the chip's own label, not beside it. */
const CHIP_CLASS =
  'rounded-md border border-stone-300 bg-stone-0 px-3 py-1.5 text-sm font-semibold text-stone-900';

const SORT_LABELS: Record<BookingSort, string> = {
  soonest: 'Soonest first',
  latest: 'Latest first',
};

/** "All categories" is the absence of a filter, so it carries no value. */
const ALL_CATEGORIES = '';

export interface BookingsRefineChipsProps {
  /** Carried through every navigation so refining never silently changes tab. */
  tab: BookingTab;
  /** The categories this customer has actually booked, already sorted. */
  categories: readonly string[];
  category: string | null;
  sort: BookingSort;
}

/**
 * Frame `07`'s two Refine chips, `All categories ▾` and `Soonest first ▾`.
 *
 * **They were `<span>`s until #302** — the right pixels with nothing behind
 * them: not focusable, no `role`, no handler, no URL param. `31`'s rule is that
 * a control which opens nothing is furniture, and these opened nothing while
 * looking exactly like the Sort chip on search, which works.
 *
 * State lives in the URL rather than in this component, for the same reason the
 * tabs beside it are `<Link>`s: a refined hub is a shareable, back-button-able
 * place, and the list is server-rendered from those params. This is a client
 * component only because a dropdown needs open/closed state and a router push.
 */
export function BookingsRefineChips({
  tab,
  categories,
  category,
  sort,
}: BookingsRefineChipsProps): React.ReactElement {
  const router = useRouter();
  const [openChip, setOpenChip] = useState<'category' | 'sort' | null>(null);

  const go = (next: { category?: string | null; sort?: BookingSort }): void => {
    const params = new URLSearchParams({ tab });
    const chosenCategory = next.category === undefined ? category : next.category;
    const chosenSort = next.sort ?? sort;

    if (chosenCategory) {
      params.set('category', chosenCategory);
    }
    /*
     * `soonest` is the default, so it stays out of the URL — a link to the hub
     * and a link to the hub sorted soonest-first are the same place, and
     * spelling the default out makes two URLs for it.
     */
    if (chosenSort !== 'soonest') {
      params.set('sort', chosenSort);
    }

    setOpenChip(null);
    router.push(`/bookings?${params.toString()}`);
  };

  const chipOpen = (key: 'category' | 'sort') => (next: boolean) =>
    setOpenChip((current) => (next ? key : current === key ? null : current));

  return (
    <div className="flex gap-2 pb-1.25">
      {/*
        Drawn whenever the customer has booked anything with a category, because
        frame `07` draws it and the composition is the design. It is dropped only
        when *nothing* carries one — a dropdown whose sole option is "All
        categories" is the furniture this ticket exists to remove, and unlike the
        one-category case it cannot even name what it is filtering.
      */}
      {categories.length > 0 ? (
        <SingleSelectDropdown
          open={openChip === 'category'}
          onOpenChange={chipOpen('category')}
          label="Filter by category"
          density="compact"
          countNoun="categories"
          options={[
            { value: ALL_CATEGORIES, label: 'All categories' },
            ...categories.map((name) => ({ value: name, label: name })),
          ]}
          value={category ?? ALL_CATEGORIES}
          onChange={(next) => go({ category: next === ALL_CATEGORIES ? null : next })}
          trigger={
            <button type="button" className={CHIP_CLASS}>
              {`${category ?? 'All categories'} ▾`}
            </button>
          }
        />
      ) : null}

      <SingleSelectDropdown
        open={openChip === 'sort'}
        onOpenChange={chipOpen('sort')}
        label="Sort bookings"
        density="compact"
        options={BOOKING_SORTS.map((name) => ({ value: name, label: SORT_LABELS[name] }))}
        value={sort}
        onChange={(next) => go({ sort: next as BookingSort })}
        trigger={
          <button type="button" className={CHIP_CLASS}>
            {`${SORT_LABELS[sort]} ▾`}
          </button>
        }
      />
    </div>
  );
}
