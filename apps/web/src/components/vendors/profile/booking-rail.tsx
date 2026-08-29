'use client';

import { formatPrice, type ServicePackage } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface BookingRailProps {
  businessName: string;
  /** Carries the chosen package through to the request form's rail. */
  slug: string;
  startingPriceCents: number | null;
  packages: readonly ServicePackage[];
  reviewCount: number;
}

/**
 * The rail from frame `03`, in the frame's fixed order: from-price, the event
 * fields, both CTAs, the charge reassurance, then the trust lines.
 *
 * `Request booking` opens frame `04` with the selected package already in its
 * rail. `Send a message` still renders disabled — messaging is #8 — following
 * the rule #31 established: a control that opens nothing either does something
 * or says why it cannot, and it never simply disappears, because hiding it
 * would leave the page with no visible ask.
 */
export function BookingRail({
  businessName,
  slug,
  startingPriceCents,
  packages,
  reviewCount,
}: BookingRailProps): React.ReactElement {
  const fieldId = useId();
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');

  const selected = packages.find((servicePackage) => servicePackage.id === packageId);
  const shownPriceCents = selected?.priceCents ?? startingPriceCents;

  return (
    <aside
      aria-label={`Book ${businessName}`}
      className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_4px_18px_rgba(35,32,28,.09)]"
    >
      <div className="border-b border-stone-200 px-5 pt-4.5 pb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-stone-600">From</span>
        </div>
        {shownPriceCents === null ? (
          /*
            No package priced yet. The frame has no state for this, but a rail
            headed by a blank price is worse than one that says the price is a
            conversation — and the message CTA below is exactly that route.
          */
          <p className="mt-0.5 font-display text-[26px] text-stone-900">Contact for pricing</p>
        ) : (
          <div className="mt-0.5 flex items-baseline gap-1.75">
            <span className="font-display text-[36px] text-stone-900">
              {formatPrice(shownPriceCents)}
            </span>
            {selected?.durationHours ? (
              <span className="text-[13px] text-stone-600">
                · {selected.durationHours} hour coverage
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-3.5 pb-4">
        {packages.length > 0 ? (
          <div>
            <Label
              htmlFor={`${fieldId}-package`}
              className="mb-1.25 text-[10.5px] font-semibold tracking-[.05em] text-stone-600 uppercase"
            >
              Package
            </Label>
            <select
              id={`${fieldId}-package`}
              value={packageId}
              onChange={(event) => setPackageId(event.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2.5 text-base text-stone-900"
            >
              {packages.map((servicePackage) => (
                <option key={servicePackage.id} value={servicePackage.id}>
                  {servicePackage.name} — {formatPrice(servicePackage.priceCents)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Button asChild variant="primary" className="mt-1 w-full justify-center py-3.25">
          <Link
            href={
              packageId
                ? `/vendors/${slug}/request?package=${packageId}`
                : `/vendors/${slug}/request`
            }
          >
            Request booking
          </Link>
        </Button>
        <Button variant="secondary" disabled className="w-full justify-center py-3">
          Send a message
        </Button>

        {/*
          The helper line explains the disabled pair rather than leaving a dead
          control unexplained, and still carries the frame's charge reassurance
          — which is true today and stays true when the buttons wake up.
        */}
        <p className="mt-0.5 text-center text-[11.5px] leading-normal text-stone-600">
          Messaging opens shortly. You won&rsquo;t be charged yet — {businessName} confirms the date
          first.
        </p>
      </div>

      <ul className="flex flex-col gap-2.25 border-t border-stone-200 px-5 py-3.25">
        {[
          'Payment held until the event is done',
          'Full refund if cancelled 48h+ ahead',
          reviewCount > 0
            ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'} from verified bookings`
            : 'Every review comes from a completed booking',
        ].map((line) => (
          <li key={line} className="flex items-center gap-2.25 text-[12.5px] text-stone-700">
            <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-sage-400" />
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}
