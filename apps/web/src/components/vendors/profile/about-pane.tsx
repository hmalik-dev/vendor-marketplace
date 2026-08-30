import { kmToMiles, type ServicePackage } from '@vendor-marketplace/shared';
import { cn } from '@/lib/utils';

/** The frame draws three included lines; a fourth would push the CTA off. */
const VISIBLE_INCLUSION_COUNT = 3;

export interface AboutPaneProps {
  bio: string | null;
  yearsInBusiness: number | null;
  completedEventCount: number;
  serviceRadiusKm: number | null;
  /** The vendor's active packages, cheapest first is not assumed. */
  packages: readonly ServicePackage[];
  onSeePackagesHref: string;
}

/**
 * Frame `03`'s About tab: the bio, three stat tiles, and **What's included**.
 *
 * Two things the pane used to carry are gone, and both were removed by the
 * design rather than by a judgement here. The **tagline pull-quote** moved into
 * the identity card, so About stopped repeating it. The **four-up Recent work
 * strip** is deleted outright — the header cover and the Portfolio tab already
 * carry the photography, and a third place to put it was the reason the same
 * image appeared three times on one screen.
 *
 * **Every tile is read from the database**, and every one is something the
 * vendor entered about themselves rather than a figure the platform computed.
 * `12-vendor-profile.md` names the three — Experience, Events, Travels — and
 * defers a "Replies" tile explicitly, because reply time is not true on the
 * first day a profile is published the way the other three are.
 *
 * Any of them can be absent. Two tiles is a valid state, and so is none: a
 * vendor who has not said how long they have been working gets no Experience
 * tile rather than a zero, which would read as a judgement.
 */

/**
 * Years as the tile draws them.
 *
 * Zero is a real answer — a vendor who started this year — and it is the one
 * value that cannot be rendered as a number: "0 yrs" reads as a data error
 * where "Less than a year" reads as a new business, which is what it is.
 */
function experienceValue(years: number): string {
  if (years === 0) {
    return 'Less than a year';
  }

  return `${years} yr${years === 1 ? '' : 's'}`;
}

/**
 * What the cheapest package includes.
 *
 * The cheapest one specifically, because the rail two columns over prices the
 * page from the same package — "From $1,450" and these lines have to describe
 * one thing, or the screen quietly advertises inclusions the starting price
 * does not buy.
 */
function startingInclusions(packages: readonly ServicePackage[]): readonly string[] {
  const cheapest = packages.reduce<ServicePackage | null>(
    (best, current) => (best === null || current.priceCents < best.priceCents ? current : best),
    null,
  );

  return cheapest?.inclusions.slice(0, VISIBLE_INCLUSION_COUNT) ?? [];
}

export function AboutPane({
  bio,
  yearsInBusiness,
  completedEventCount,
  serviceRadiusKm,
  packages,
  onSeePackagesHref,
}: AboutPaneProps): React.ReactElement {
  const tiles: Array<{ label: string; value: string }> = [];

  if (yearsInBusiness !== null) {
    tiles.push({ label: 'Experience', value: experienceValue(yearsInBusiness) });
  }
  // A vendor with no completed events shows nothing rather than "0 events",
  // which reads as a judgement rather than a new listing.
  if (completedEventCount > 0) {
    tiles.push({ label: 'Events', value: String(completedEventCount) });
  }
  if (serviceRadiusKm !== null) {
    tiles.push({ label: 'Travels', value: `${Math.round(kmToMiles(serviceRadiusKm))} mi` });
  }

  const inclusions = startingInclusions(packages);

  return (
    <div>
      {bio ? (
        <p className="max-w-[640px] text-[14.5px] leading-[1.7] text-stone-700">{bio}</p>
      ) : (
        <p className="max-w-[640px] text-[14.5px] leading-[1.7] text-stone-600">
          This vendor hasn&apos;t written an introduction yet.
        </p>
      )}

      {tiles.length > 0 ? (
        <dl className="mt-5 grid max-w-[520px] gap-3.5 sm:grid-cols-3">
          {tiles.map((tile) => (
            /*
              12px, which is the frame's own and `12-vendor-profile.md`'s —
              between the 10px of a button and the 14px `rounded-xl` of a card,
              so neither token fits and the value is stated.
            */
            <div key={tile.label} className="rounded-[12px] bg-stone-0 px-3.5 py-3">
              <dt className="text-label font-semibold tracking-label text-stone-600 uppercase">
                {tile.label}
              </dt>
              <dd className="mt-0.75 font-display text-[22px] text-stone-900">{tile.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/*
        Absent rather than empty when the vendor has listed no inclusions. A
        heading over nothing states a promise the page cannot keep, and the
        Packages tab is still one click away from the tab row.
      */}
      {inclusions.length > 0 ? (
        <section className={cn('max-w-[640px]', tiles.length > 0 ? 'mt-5.5' : 'mt-5')}>
          <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">
            What&apos;s included
          </h2>
          <ul className="mt-2.5 flex flex-col gap-1.75 text-[14px] text-stone-700">
            {inclusions.map((inclusion) => (
              <li key={inclusion} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-sage-400" />
                {inclusion}
              </li>
            ))}
          </ul>
          <a
            href={onSeePackagesHref}
            className="mt-2 inline-block rounded-xs text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
          >
            See all packages →
          </a>
        </section>
      ) : null}
    </div>
  );
}
