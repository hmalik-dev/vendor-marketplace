import { kmToMiles } from '@vendor-marketplace/shared';
import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { PortfolioStrip } from './portfolio-strip';

export interface AboutPaneProps {
  bio: string | null;
  completedEventCount: number;
  serviceRadiusKm: number | null;
  responseTimeHours: number | null;
  portfolio: readonly WirePortfolioItem[];
  onSeeAllHref: string;
}

/**
 * Frame `03`'s About tab: the bio, three stat tiles, and a four-up strip of
 * recent work.
 *
 * **Every tile is read from the database.** The frame also draws a Serif italic
 * pull-quote and an "Experience · 10 yrs" tile; neither has a column behind it,
 * and inventing one would put a number on the page that no vendor entered. Both
 * are ticket #41 — a tagline and an experience figure are product decisions
 * before they are migrations.
 */
export function AboutPane({
  bio,
  completedEventCount,
  serviceRadiusKm,
  responseTimeHours,
  portfolio,
  onSeeAllHref,
}: AboutPaneProps): React.ReactElement {
  const tiles: Array<{ label: string; value: string }> = [];

  // A vendor with no completed events shows nothing rather than "0 events",
  // which reads as a judgement rather than a new listing.
  if (completedEventCount > 0) {
    tiles.push({ label: 'Events', value: String(completedEventCount) });
  }
  if (serviceRadiusKm !== null) {
    tiles.push({ label: 'Travels', value: `${Math.round(kmToMiles(serviceRadiusKm))} mi` });
  }
  if (responseTimeHours !== null) {
    tiles.push({ label: 'Replies in', value: `${responseTimeHours} hrs` });
  }

  return (
    <div>
      {bio ? (
        <p className="max-w-[640px] text-[14.5px] leading-[1.7] text-stone-700">{bio}</p>
      ) : (
        <p className="max-w-[640px] text-[14.5px] leading-[1.7] text-stone-600">
          This vendor hasn&rsquo;t written an introduction yet.
        </p>
      )}

      {tiles.length > 0 ? (
        <dl className="mt-5 grid max-w-[520px] gap-3.5 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl bg-stone-0 px-3.5 py-3">
              <dt className="text-[10.5px] font-semibold tracking-[.05em] text-stone-600 uppercase">
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
