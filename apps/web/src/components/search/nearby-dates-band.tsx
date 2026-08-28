'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NEARBY_ALTERNATIVES_LIMIT } from '@vendor-marketplace/shared';
import { apiRequest } from '@/lib/api-client';
import { wireNearbyAvailabilityResultSchema, type WireNearbyVendor } from '@/lib/wire-schemas';
import { VendorCard } from '@/components/vendors/vendor-card';

/**
 * "Free on a nearby date instead" — the band that closes frame `18`.
 *
 * A customer whose date came back empty is at a dead end, and the one thing
 * that reliably unsticks them is seeing who could do the week either side.
 *
 * **Absent, never empty.** If nobody is free nearby, this renders nothing at
 * all: the screen above already stands on its own, and "nobody nearby either"
 * is a worse answer than not raising the question. The same goes for a failed
 * request — this is a helpful addition to a screen that is already complete,
 * so it fails silently rather than putting an error on top of a dead end.
 */

export interface NearbyDatesBandProps {
  /** The date that came back empty. Without one there is nothing to be near. */
  date: string;
  category: string;
  city: string;
}

export function NearbyDatesBand({
  date,
  category,
  city,
}: NearbyDatesBandProps): React.ReactElement | null {
  const [vendors, setVendors] = useState<WireNearbyVendor[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (date === '') {
      setVendors([]);
      setTotal(0);
      return;
    }

    // The customer can keep changing filters while this is in flight, and a
    // late answer about a query they have moved past is worse than none.
    const controller = new AbortController();
    const params = new URLSearchParams({ date, limit: String(NEARBY_ALTERNATIVES_LIMIT) });
    if (category !== '') {
      params.set('category', category);
    }
    if (city !== '') {
      params.set('city', city);
    }

    apiRequest(`/vendors/availability/nearby?${params.toString()}`, {
      schema: wireNearbyAvailabilityResultSchema,
      token: null,
      signal: controller.signal,
    })
      .then((body) => {
        setVendors(body.items);
        setTotal(body.total);
      })
      .catch(() => {
        // Deliberately silent — see the note on the component.
        setVendors([]);
        setTotal(0);
      });

    return () => controller.abort();
  }, [date, category, city]);

  if (vendors.length === 0) {
    return null;
  }

  const seeAllParams = new URLSearchParams();
  if (category !== '') {
    seeAllParams.set('category', category);
  }
  if (city !== '') {
    seeAllParams.set('city', city);
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-[1000px] border-t border-stone-300 pt-6">
      <div className="mb-3.5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[19px] text-stone-900">Free on a nearby date instead</h2>
        {/*
          The count is the one the request measured, not the number of cards on
          screen. A "see all" that counts what is already visible is a lie, and
          #31's rule is that a control which opens nothing is furniture — so
          the link only appears when there is genuinely more behind it.
        */}
        {total > vendors.length ? (
          <Link
            href={`/search?${seeAllParams.toString()}`}
            className="shrink-0 text-xs font-semibold text-clay-600 hover:underline"
          >
            See all {total} in the region &rarr;
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            density="compact"
            // Not the searched date — the point of the card is the other one.
            freeOnDate={vendor.nearestAvailableDate}
          />
        ))}
      </div>
    </section>
  );
}
