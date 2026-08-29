import { kmToMiles } from '@vendor-marketplace/shared';
import { cn } from '@/lib/utils';
import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { PortfolioStrip } from './portfolio-strip';

export interface AboutPaneProps {
  bio: string | null;
  tagline: string | null;
  yearsInBusiness: number | null;
  completedEventCount: number;
  serviceRadiusKm: number | null;
  portfolio: readonly WirePortfolioItem[];
  onSeeAllHref: string;
}

/**
 * Frame `03`'s About tab: the pull-quote, the bio, three stat tiles, and a
 * four-up strip of recent work.
 *
 * **Every tile is read from the database**, and every one of them is something
 * the vendor entered about themselves rather than a figure the platform
 * computed. `12-vendor-profile.md` names the three — Experience, Events,
 * Travels — and defers a "Replies" tile explicitly, because reply time is not
 * true on the first day a profile is published the way the other three are.
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
export function AboutPane({
  bio,
  tagline,
  yearsInBusiness,
  completedEventCount,
  serviceRadiusKm,
  portfolio,
  onSeeAllHref,
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

  return (
    <div>
      {tagline ? (
        /*
          The vendor's own words, exactly as entered — never truncated and
          never re-cased. The quotation marks are the frame's, and they are
          curly so a straight quote inside the tagline reads as nested rather
          than as the end of the quote.
        */
        <p className="max-w-[620px] font-display text-[20px] leading-[1.4] text-stone-700 italic">
          &ldquo;{tagline}&rdquo;
        </p>
      ) : null}

      {bio ? (
        <p
          className={cn(
            'max-w-[640px] text-[14.5px] leading-[1.7] text-stone-700',
            // 14px under the pull-quote when there is one; otherwise the tab's
            // own top padding already places it.
            tagline && 'mt-3.5',
          )}
        >
          {bio}
        </p>
      ) : (
        <p
          className={cn(
            'max-w-[640px] text-[14.5px] leading-[1.7] text-stone-600',
            tagline && 'mt-3.5',
          )}
        >
          This vendor hasn&rsquo;t written an introduction yet.
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

      <PortfolioStrip items={portfolio} seeAllHref={onSeeAllHref} />
    </div>
  );
}
