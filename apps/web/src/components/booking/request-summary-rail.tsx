'use client';

import { bookingRequestWindowPhrase, formatPrice } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface RailVendor {
  businessName: string;
  avatarUrl: string | null;
  avgRating: number;
  reviewCount: number;
  /** The vendor's leading category — "Photography" in the frame's sub-line. */
  categoryName: string | null;
}

export interface RailPackage {
  name: string;
  priceCents: number;
  inclusions: readonly string[];
  durationHours: number | null;
}

export interface RequestSummaryRailProps {
  vendor: RailVendor;
  /** `null` for a custom request, which trades the package block for a brief. */
  servicePackage: RailPackage | null;
  customDetails: string;
  onCustomDetailsChange: (value: string) => void;
  customDetailsId: string;
  customDetailsInvalid: boolean;
  /** Frame `04`'s primary: "Continue to review", then "Send request" on step 2. */
  primaryLabel: string;
  onPrimary: () => void;
  submitting: boolean;
  /** How many red issues stand between the customer and sending. */
  blockerCount: number;
  /** Where "Ask a question first" goes — the vendor's own page, for now. */
  askHref: string;
}

/**
 * The 400px rail from frame `04`: who is being asked, what for, what it comes
 * to, the reassurance, and then the action — in that order, and the reassurance
 * directly above the action rather than below it.
 *
 * It is the whole reason this is a page and not a modal: the vendor, the
 * package and the total stay on screen while the form is filled.
 */
export function RequestSummaryRail({
  vendor,
  servicePackage,
  customDetails,
  onCustomDetailsChange,
  customDetailsId,
  customDetailsInvalid,
  primaryLabel,
  onPrimary,
  submitting,
  blockerCount,
  askHref,
}: RequestSummaryRailProps): React.ReactElement {
  const blocked = blockerCount > 0;

  return (
    <aside
      aria-label={`Requesting ${vendor.businessName}`}
      className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_2px_10px_rgba(35,32,28,.06)]"
    >
      <div className="flex items-center gap-3 border-b border-stone-200 px-4.5 py-4">
        {vendor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote CDN host is not in the image config yet (#47)
          <img
            src={vendor.avatarUrl}
            alt=""
            className="size-14.5 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span aria-hidden="true" className="size-14.5 shrink-0 rounded-xl bg-stone-150" />
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[19px] text-stone-900">{vendor.businessName}</p>
          <p className="mt-0.5 text-sm text-stone-600">
            {vendor.reviewCount > 0
              ? `★ ${vendor.avgRating.toFixed(1)} (${vendor.reviewCount})`
              : 'No reviews yet'}
            {vendor.categoryName ? ` · ${vendor.categoryName}` : null}
          </p>
        </div>
      </div>

      {servicePackage ? (
        <div className="border-b border-stone-200 px-4.5 py-3.5">
          <div className="mb-2 flex justify-between gap-3 text-base text-stone-700">
            <span>{servicePackage.name}</span>
            <span className="font-semibold">{formatPrice(servicePackage.priceCents)}</span>
          </div>
          {servicePackage.inclusions.length > 0 ? (
            <p className="text-sm leading-prose text-stone-600">
              {servicePackage.inclusions.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        /*
         * No package means nothing to quote from, so the rail asks for the
         * brief instead — required, where the form column's note is optional.
         */
        <div className="border-b border-stone-200 px-4.5 py-3.5">
          <Label
            htmlFor={customDetailsId}
            className="mb-1.5 text-label font-semibold tracking-label text-stone-600 uppercase"
          >
            Describe what you need
          </Label>
          <Textarea
            id={customDetailsId}
            value={customDetails}
            onChange={(event) => onCustomDetailsChange(event.target.value)}
            aria-invalid={customDetailsInvalid}
            placeholder="Two hours of engagement portraits at Zilker, golden hour."
            className="min-h-24 rounded-[10px] border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900"
          />
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 border-b border-stone-200 px-4.5 py-3.5">
        <span className="text-base text-stone-700">Estimated total</span>
        {/*
          The Serif 26px slot is for a figure. A custom request has none yet, so
          it says so in the body face — a sentence set like a price reads as one.
        */}
        {servicePackage ? (
          <span className="font-display text-[26px] text-stone-900">
            {formatPrice(servicePackage.priceCents)}
          </span>
        ) : (
          <span className="text-base text-stone-700">Set by the quote</span>
        )}
      </div>

      {/*
        Gold, because the customer is waiting on someone — and directly above
        the action, which is the one placement `13-booking-request.md` makes an
        acceptance criterion.
      */}
      <div className="flex gap-2.5 bg-gold-50 px-4.5 py-3.5">
        <span aria-hidden="true" className="mt-1.25 size-2 shrink-0 rounded-full bg-gold-400" />
        <p className="text-sm leading-[1.55] text-gold-600">
          You&rsquo;re requesting, not paying. {vendor.businessName} has{' '}
          {bookingRequestWindowPhrase()} to confirm or send a revised quote — you approve before any
          card is charged.
        </p>
      </div>

      <div className="flex flex-col gap-2.25 px-4.5 py-3.5">
        {blocked ? (
          <p className="flex items-center gap-2 text-sm font-medium text-error-500">
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-full border-[1.5px] border-error-500 bg-error-50"
            />
            {blockerCount} {blockerCount === 1 ? 'field' : 'fields'} to fix
          </p>
        ) : null}

        {/*
          The blocked primary keeps its place and its label — `40-states.md`
          rules out hiding it — and goes to the disabled clay fill, with the
          helper line below saying what is holding it.
        */}
        <Button
          type="button"
          variant="primary"
          onClick={onPrimary}
          loading={submitting}
          className={cn(
            'w-full justify-center py-3.25',
            blocked && 'bg-clay-300 hover:bg-clay-300',
          )}
        >
          {submitting ? 'Sending…' : primaryLabel}
        </Button>

        {blocked ? (
          <p className="text-center text-xs leading-normal text-stone-600">
            Fix the fields above and this goes straight to {vendor.businessName}.
          </p>
        ) : (
          <Link
            href={askHref}
            className="text-center text-sm font-semibold text-clay-500 hover:underline"
          >
            Ask a question first
          </Link>
        )}
      </div>
    </aside>
  );
}
