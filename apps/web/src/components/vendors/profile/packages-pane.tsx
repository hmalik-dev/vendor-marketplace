import { formatPrice, type ServicePackage } from '@vendor-marketplace/shared';
import { Check } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PRICE_TYPE_LABELS } from '@/lib/package-labels';
import { cn } from '@/lib/utils';

/**
 * The left border deepens with the tier, so the cheapest, middle and dearest
 * package read as a ladder at a glance rather than three identical cards.
 * Beyond three, everything above the second keeps the darkest.
 */
const TIER_BORDERS = ['border-l-clay-200', 'border-l-clay-300', 'border-l-clay-400'] as const;

export interface PackagesPaneProps {
  packages: readonly ServicePackage[];
  businessName: string;
}

export function PackagesPane({ packages, businessName }: PackagesPaneProps): React.ReactElement {
  if (packages.length === 0) {
    return (
      <EmptyState
        headline="No packages listed yet"
        description={`${businessName} hasn't published pricing. Ask them what a day like yours costs.`}
      />
    );
  }

  return (
    <ul className="grid max-w-[680px] gap-3.5 sm:grid-cols-2">
      {packages.map((servicePackage, index) => (
        <li
          key={servicePackage.id}
          className={cn(
            'rounded-xl border-l-3 bg-stone-0 p-4 shadow-sm',
            TIER_BORDERS[Math.min(index, TIER_BORDERS.length - 1)],
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[19px] text-stone-900">{servicePackage.name}</h3>
            <span className="shrink-0 font-display text-[19px] text-stone-900">
              {formatPrice(servicePackage.priceCents)}
            </span>
          </div>

          <p className="mt-1.5 text-[13.5px] leading-[1.6] text-stone-700">
            {servicePackage.description}
          </p>

          <p className="mt-2 text-xs text-stone-600">
            {[
              PRICE_TYPE_LABELS[servicePackage.priceType],
              servicePackage.durationHours ? `${servicePackage.durationHours} hours` : null,
              servicePackage.maxGuests ? `up to ${servicePackage.maxGuests} guests` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {servicePackage.inclusions.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {servicePackage.inclusions.map((inclusion) => (
                <li
                  key={inclusion}
                  className="flex items-start gap-2 text-[13px] leading-[1.5] text-stone-700"
                >
                  <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-clay-400" />
                  {inclusion}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
