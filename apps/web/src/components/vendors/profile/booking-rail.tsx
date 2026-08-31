'use client';

import {
  MAX_GUEST_COUNT,
  formatPrice,
  openedConversationSchema,
  type AvailabilityStatus,
  type ServicePackage,
} from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateDropdown } from '@/components/ui/dropdown-date';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api-client';
import { signInPathReturningTo } from '@/lib/return-path';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

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
 * rail. `Send a message` opens the thread with this vendor and goes to it —
 * #110's ruling, answered by #310 in the only way that satisfies the rule #31
 * established: a control either does something or says why it cannot, and the
 * thread it needed now exists to be opened.
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
  const errorId = `${fieldId}-message-error`;
  const router = useRouter();
  const call = useApi();
  /*
   * The cheapest package, not the first one the vendor dragged into place.
   *
   * `findActivePackages` orders by `displayOrder`, while `startingPriceCents`
   * is `MIN(price_cents)` — two different orderings. Preselecting `packages[0]`
   * therefore opened the rail on an arbitrary price for any vendor who did not
   * happen to order cheapest-first, so frame `03`'s resting state of
   * `From $1,450` showed a different number, and the `/search` card for the
   * same vendor disagreed with their own profile.
   */
  const cheapest = packages.reduce<ServicePackage | undefined>(
    (lowest, candidate) =>
      lowest === undefined || candidate.priceCents < lowest.priceCents ? candidate : lowest,
    undefined,
  );
  const [packageId, setPackageId] = useState(cheapest?.id ?? '');
  const [packageOpen, setPackageOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  /*
   * The bar's date control has its own open flag, not the rail's. Only one of
   * the two layouts is rendered at any width, so sharing a flag would never
   * misbehave -- but it would tie two triggers to one piece of UI state and
   * make the next person check which of them owns it.
   */
  const [barDateOpen, setBarDateOpen] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [opening, setOpening] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  /*
   * Opens the thread with this vendor and goes to it. The call is idempotent,
   * so a second click lands on the same conversation rather than opening one
   * beside it — the button is safe to press twice, which is what makes
   * `opening` a spinner-free guard rather than a correctness one.
   *
   * A signed-out visitor is sent to sign in *carrying this page*, because the
   * profile is where they were and where the button they pressed lives.
   * `opening` stays set on both navigations: the component is about to be
   * unmounted, and clearing it would re-enable a control on a page that is
   * leaving.
   */
  const openThread = useCallback(async () => {
    setOpening(true);
    setMessageError(null);

    try {
      const { id } = await call('/conversations', {
        method: 'POST',
        body: { vendorSlug: slug },
        schema: openedConversationSchema,
      });

      router.push(`/messages?conversation=${id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        router.push(signInPathReturningTo(`${window.location.pathname}${window.location.search}`));
        return;
      }

      setMessageError('That did not go through. Try again in a moment.');
      setOpening(false);
    }
  }, [call, router, slug]);

  const selected = packages.find((servicePackage) => servicePackage.id === packageId);
  const shownPriceCents = selected?.priceCents ?? startingPriceCents;
  /** Whether the price on screen is still the lowest this vendor charges. */
  const isStartingPrice = shownPriceCents !== null && shownPriceCents === startingPriceCents;

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

  /*
   * Below `lg` the rail is not a rail. Frame `27 Vendor profile - 768` replaces
   * it with a bar pinned to the bottom of the viewport, and `30-responsive.md`
   * says the same thing twice -- "rail becomes a sticky bottom bar" at 768, and
   * again at 390. Until #371 this had no counterpart at all: the card simply
   * stacked under the About pane, so the primary action on the screen sat
   * wherever the content happened to end.
   *
   * Both layouts render from this one component rather than from two, because
   * they share every piece of state that matters -- the chosen package, the
   * chosen date, the message-thread request in flight. Two components would
   * mean two sources of truth for the date a customer just picked, and the
   * frame's bar carries that date.
   *
   * Only one is ever in the accessibility tree: each is hidden by `display`
   * at the other's widths, not merely moved offscreen.
   */
  const bottomBar = (
    <div
      aria-label={`Book ${businessName}`}
      role="region"
      /*
       * `data-booking-bar` is not decoration: `globals.css` uses it to give the
       * footer this bar's height as bottom padding. The bar is `fixed`, and the
       * footer is a sibling of `<main>`, so no padding inside this component can
       * reach it -- which is exactly the overlap the browser pass measured.
       */
      data-booking-bar=""
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-center gap-4 border-t border-stone-300 bg-stone-0 px-6 py-3 shadow-[0_-4px_18px_rgba(35,32,28,.07)] lg:hidden"
    >
      <div className="shrink-0">
        <div className="text-[11px] text-stone-600">From</div>
        {shownPriceCents === null ? (
          <div className="font-display text-[19px] leading-[1.1] text-stone-900">On request</div>
        ) : (
          <div className="font-display text-[24px] leading-[1.1] text-stone-900">
            {formatPrice(shownPriceCents)}
          </div>
        )}
      </div>

      <DateDropdown
        open={barDateOpen}
        onOpenChange={setBarDateOpen}
        label="Event date"
        value={eventDate === '' ? null : eventDate}
        onChange={(next) => setEventDate(next ?? '')}
        today={today}
        calendar={calendar}
        trigger={
          <button
            type="button"
            id={`${fieldId}-bar-date`}
            aria-haspopup="dialog"
            aria-expanded={barDateOpen}
            className={`${FIELD} flex max-w-[180px] flex-1 items-center justify-between gap-2 text-left text-[13.5px]`}
          >
            <span className={cn('truncate', eventDate === '' && 'text-stone-600')}>
              {eventDate === '' ? 'Add a date' : formatMonthDay(eventDate)}
            </span>
            <span
              aria-hidden="true"
              className={cn('shrink-0 text-base', barDateOpen ? 'text-clay-400' : 'text-stone-600')}
            >
              {barDateOpen ? '\u25b4' : '\u25be'}
            </span>
          </button>
        }
      />

      {/*
       * `px-0` and `text-[14px]`: the frame gives this `padding:13px 0` and
       * centres it with `flex:1`, so the primary's default horizontal padding
       * would narrow the clay box inside a button that is already the right
       * width.
       */}
      <Button asChild variant="primary" className="flex-1 justify-center px-0 py-3.25 text-[14px]">
        <Link href={requestHref}>Request booking</Link>
      </Button>
      {/*
       * `Message`, not the rail's `Send a message`. The frame draws the shorter
       * word here and the longer one in the rail, which is not an inconsistency
       * to normalise away: the bar has four controls across 768px and the rail
       * has a full column.
       */}
      <Button
        variant="secondary"
        onClick={openThread}
        disabled={opening}
        className="shrink-0 px-4.5 py-3"
      >
        Message
      </Button>
    </div>
  );

  return (
    <>
      <aside
        aria-label={`Book ${businessName}`}
        className="overflow-hidden rounded-[18px] bg-stone-0 shadow-[0_4px_18px_rgba(35,32,28,.09)] max-lg:hidden"
      >
        {/* `16px 18px 14px` at 1024 (`27`), `18px 20px 16px` at 1440 (`03`). */}
        <div className="border-b border-stone-200 px-4.5 pt-4 pb-3.5 min-[90rem]:px-5 min-[90rem]:pt-4.5 min-[90rem]:pb-4">
          <div className="flex items-baseline justify-between gap-3">
            {/*
            "From" says the number beside it is the lowest this vendor charges,
            so it belongs exactly while that is true. The rail opens on the
            cheapest package, so the resting state still reads "From $1,450" as
            `12-vendor-profile.md` draws it; choose a dearer one and the
            qualifier goes. #81's first finding was this rail reading
            "From $3,900" for a chosen package while the search card said
            "From $1,450" for the same vendor — two numbers under one
            qualifier, and only one of them a price anything starts at.

            Hidden rather than removed, so the row keeps its height: an empty
            element has no content box, so dropping the word would collapse this
            flex row and shift the price up by a line. `invisible` is
            `visibility: hidden`, which takes it out of the accessibility tree
            as well as off the screen.
          */}
            <span
              className={cn(
                'text-[12px] text-stone-600 min-[90rem]:text-[12.5px]',
                !isStartingPrice && 'invisible',
              )}
            >
              From
            </span>
            {freeOn ? (
              <span className="text-[11.5px] font-semibold text-sage-600 min-[90rem]:text-[12px]">
                Free on {freeOn}
              </span>
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
            <div className="mt-0.5 flex items-baseline gap-1.5 min-[90rem]:gap-1.75">
              <span className="font-display text-[32px] text-stone-900 min-[90rem]:text-[36px]">
                {formatPrice(shownPriceCents)}
              </span>
              {selected?.durationHours ? (
                <span className="text-[12px] text-stone-600 min-[90rem]:text-[13px]">
                  · {selected.durationHours} hour coverage
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* `12px 18px 14px` on a 9px stack at 1024, `14px 20px 16px` on 10px at 1440. */}
        <div className="flex flex-col gap-2.25 px-4.5 pt-3 pb-3.5 min-[90rem]:gap-2.5 min-[90rem]:px-5 min-[90rem]:pt-3.5 min-[90rem]:pb-4">
          {/*
          Frame `03` pairs the date and the guest count on one row above the
          package, at `flex: 1` and `flex: .7`. Both carry straight through to
          the request form in the query string, so what the customer answers
          here is not asked again on the next screen.
        */}
          <div className="flex gap-2.25 min-[90rem]:gap-2.5">
            <div className="flex-1">
              <Label htmlFor={`${fieldId}-date`} className={FIELD_LABEL}>
                Event date
              </Label>
              {/*
              The designed picker, and the one place it has real marks to draw:
              this vendor's calendar is already in scope, so a day they are
              booked on is hatched and struck through here rather than being
              accepted and then refused on the next screen. Frame `28`'s note is
              that the customer's picker inherits the vendor calendar's marks
              exactly — this is that, with the same vendor's data behind it.
            */}
              <DateDropdown
                open={dateOpen}
                onOpenChange={setDateOpen}
                label="Event date"
                value={eventDate === '' ? null : eventDate}
                onChange={(next) => setEventDate(next ?? '')}
                today={today}
                calendar={calendar}
                trigger={
                  <button
                    type="button"
                    id={`${fieldId}-date`}
                    aria-haspopup="dialog"
                    aria-expanded={dateOpen}
                    className={`${FIELD} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className={cn('truncate', eventDate === '' && 'text-stone-600')}>
                      {eventDate === '' ? 'Add a date' : formatMonthDay(eventDate)}
                    </span>
                  </button>
                }
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
              The one dropdown (#167). This was a native select element, kept for the
              behaviour the platform gives free — but the platform also draws it,
              and suppressing the OS arrow to draw our own was already most of
              the way to replacing it. What it gave away is now provided rather
              than borrowed: a listbox, roving `aria-activedescendant`, arrows,
              type-ahead, and a bottom sheet where the OS would have drawn one.
            */}
              <SingleSelectDropdown
                open={packageOpen}
                onOpenChange={setPackageOpen}
                label="Package"
                countNoun="packages"
                options={packages.map((servicePackage) => ({
                  value: servicePackage.id,
                  label: `${servicePackage.name} — ${formatPrice(servicePackage.priceCents)}`,
                }))}
                value={packageId}
                onChange={setPackageId}
                trigger={
                  <button
                    type="button"
                    id={`${fieldId}-package`}
                    aria-haspopup="listbox"
                    aria-expanded={packageOpen}
                    className={`${FIELD} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className="truncate">
                      {selected
                        ? `${selected.name} — ${formatPrice(selected.priceCents)}`
                        : 'Choose a package'}
                    </span>
                  </button>
                }
              />
            </div>
          ) : null}

          {/* `12px 0` on a 3px offset at 1024, `13px 0` on 4px at 1440. */}
          <Button
            asChild
            variant="primary"
            className="mt-0.75 w-full justify-center py-3 min-[90rem]:mt-1 min-[90rem]:py-3.25"
          >
            <Link href={requestHref}>Request booking</Link>
          </Button>
          {/*
          #110, answered. The control was disabled under an `sr-only` line
          saying messaging was not available, because `/messages` could only
          open a thread that already existed and enabling it would have sent a
          customer nowhere. #310 gave it one to open, so the frame's enabled
          control is now the honest one — and the blocked-state copy is gone
          rather than left behind contradicting it.
        */}
          <Button
            variant="secondary"
            onClick={openThread}
            disabled={opening}
            aria-describedby={messageError ? errorId : undefined}
            className="w-full justify-center py-2.75 min-[90rem]:py-3"
          >
            Send a message
          </Button>
          {messageError ? (
            /*
            `40-states.md`: the failure is named beside the control that failed,
            in the reader's words with one thing to do. The upstream message is
            not printed — it is the API's sentence, not a reader's.
          */
            <p id={errorId} role="alert" className="text-center text-helper text-red-600">
              {messageError}
            </p>
          ) : null}

          {/*
          The frame's charge reassurance, and only that. It previously carried
          "Messaging opens shortly." in front, which frame `03` does not draw
          and which wrapped a one-line helper onto two. That sentence existed to
          explain a disabled `Send a message`, which is no longer disabled.
        */}
          <p className="text-center text-[11px] leading-normal text-stone-600 min-[90rem]:mt-0.5 min-[90rem]:text-helper">
            You won&apos;t be charged yet — {businessName} confirms the date first.
          </p>
        </div>

        {/* `12px 18px` on an 8px stack at 1024, `13px 20px` on 9px at 1440. */}
        <ul className="flex flex-col gap-2 border-t border-stone-200 px-4.5 py-3 min-[90rem]:gap-2.25 min-[90rem]:px-5 min-[90rem]:py-3.25">
          {[
            'Payment held until the event is done',
            'Full refund if cancelled 48h+ ahead',
            reviewCount > 0
              ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'} from verified bookings`
              : 'Every review comes from a completed booking',
          ].map((line) => (
            <li
              key={line}
              className="flex items-center gap-2.25 text-[12px] text-stone-700 min-[90rem]:text-[12.5px]"
            >
              <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-sage-400" />
              {line}
            </li>
          ))}
        </ul>
      </aside>
      {bottomBar}
    </>
  );
}

/** The frame's `.inp` token, shared by all three rail controls. */
/*
 * The frame's `.inp` box: 16px of content, 10px of padding either side and a
 * 1px border, which is 38px. The height is pinned rather than left to compute
 * because `input[type=date]` carries an intrinsic height from Chromium's own
 * calendar sub-control and lands on 39.5 — 1.5px taller than the `Guests`
 * input beside it, which reads as a misaligned pair on the frame's shared row.
 */
const FIELD =
  'h-[38px] w-full rounded-lg border border-stone-300 bg-stone-150 px-[13px] py-2.5 text-[13px] text-stone-900 min-[90rem]:text-base';

/* 4px under the micro-label at 1024, 5px at 1440. */
const FIELD_LABEL =
  'mb-1 min-[90rem]:mb-1.25 text-label font-semibold tracking-label text-stone-600 uppercase';

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
