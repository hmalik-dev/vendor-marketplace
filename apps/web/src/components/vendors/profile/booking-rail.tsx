'use client';

import {
  MAX_GUEST_COUNT,
  formatPrice,
  type AvailabilityStatus,
  type ServicePackage,
} from '@vendor-marketplace/shared';
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
  /** Today in the vendor's calendar, so a past date cannot be requested. */
  today: string;
  /** The vendor's published availability, keyed by `YYYY-MM-DD`. */
  calendar: Readonly<Record<string, AvailabilityStatus>>;
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
  today,
  calendar,
}: BookingRailProps): React.ReactElement {
  const fieldId = useId();
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');

  const selected = packages.find((servicePackage) => servicePackage.id === packageId);
  const shownPriceCents = selected?.priceCents ?? startingPriceCents;

  /*
   * Only answered fields travel. An empty `?date=` is not the same as no date,
   * and the request page drops anything it cannot parse anyway.
   */
  const request = new URLSearchParams();
  if (packageId) request.set('package', packageId);
  if (eventDate) request.set('date', eventDate);
  if (guestCount) request.set('guests', guestCount);
  const query = request.toString();
  const requestHref = query ? `/vendors/${slug}/request?${query}` : `/vendors/${slug}/request`;

  /*
   * Frame `03` draws this line for the searched date, so it appears once a date
   * is chosen and the vendor is free on it. A vendor publishes only the days
   * they are NOT free, so an absent date means available — the same rule the
   * request form applies, deliberately, so the two can never disagree about a
   * date. A date that is blocked, booked or already past draws nothing rather
   * than a contradiction; naming that is the request form's job, in copy
   * `40-states.md` has already approved.
   */
  const dateStatus = eventDate ? (calendar[eventDate] ?? 'available') : null;
  const freeOn =
    eventDate && eventDate >= today && dateStatus === 'available'
      ? formatMonthDay(eventDate)
      : null;

  return (
    <aside
      aria-label={`Book ${businessName}`}
      className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_4px_18px_rgba(35,32,28,.09)]"
    >
      <div className="border-b border-stone-200 px-5 pt-4.5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-stone-600">From</span>
          {freeOn ? (
            <span className="text-[12px] font-semibold text-sage-600">Free on {freeOn}</span>
          ) : null}
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
        {/*
          Frame `03` pairs the date and the guest count on one row above the
          package, at `flex: 1` and `flex: .7`. Both carry straight through to
          the request form in the query string, so what the customer answers
          here is not asked again on the next screen.
        */}
        <div className="flex gap-2.5">
          <div className="flex-1">
            <Label htmlFor={`${fieldId}-date`} className={FIELD_LABEL}>
              Event date
            </Label>
            <input
              id={`${fieldId}-date`}
              type="date"
              value={eventDate}
              min={today}
              onChange={(event) => setEventDate(event.target.value)}
              className={FIELD}
            />
          </div>
          <div className="flex-[0.7]">
            <Label htmlFor={`${fieldId}-guests`} className={FIELD_LABEL}>
              Guests
            </Label>
            <input
              id={`${fieldId}-guests`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_GUEST_COUNT}
              value={guestCount}
              onChange={(event) => setGuestCount(event.target.value)}
              className={FIELD}
            />
          </div>
        </div>

        {packages.length > 0 ? (
          <div>
            <Label htmlFor={`${fieldId}-package`} className={FIELD_LABEL}>
              Package
            </Label>
            {/*
              A real `<select>` — the element stays native so the keyboard, the
              screen reader and the mobile picker all behave — with only the
              OS-drawn arrow replaced by the frame's own glyph.
            */}
            <div className="relative">
              <select
                id={`${fieldId}-package`}
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
                className={`${FIELD} appearance-none`}
              >
                {packages.map((servicePackage) => (
                  <option key={servicePackage.id} value={servicePackage.id}>
                    {servicePackage.name} — {formatPrice(servicePackage.priceCents)}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-[13px] flex items-center text-base text-stone-600"
              >
                ▾
              </span>
            </div>
          </div>
        ) : null}

        <Button asChild variant="primary" className="mt-1 w-full justify-center py-3.25">
          <Link href={requestHref}>Request booking</Link>
        </Button>
        <Button variant="secondary" disabled className="w-full justify-center py-3">
          Send a message
        </Button>

        {/*
          The frame's charge reassurance, and only that. It previously carried
          "Messaging opens shortly." in front, which frame `03` does not draw
          and which wrapped a one-line helper onto two. That sentence was the
          only explanation the disabled `Send a message` button had; naming the
          blocker beside the control it blocks, as `40-states.md` requires, is
          #110's job and is recorded there.
        */}
        <p className="mt-0.5 text-center text-helper leading-normal text-stone-600">
          You won&apos;t be charged yet — {businessName} confirms the date first.
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

/** The frame's `.inp` token, shared by all three rail controls. */
const FIELD =
  'w-full rounded-lg border border-stone-300 bg-stone-150 px-[13px] py-2.5 text-base text-stone-900';

const FIELD_LABEL = 'mb-1.25 text-label font-semibold tracking-label text-stone-600 uppercase';

/**
 * "June 14", the way the frame writes the availability date. Built from the
 * parts rather than from `new Date(value)`, which reads a bare `YYYY-MM-DD` as
 * UTC midnight and shows the day before in any western timezone.
 */
function formatMonthDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return '';
  }

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}
