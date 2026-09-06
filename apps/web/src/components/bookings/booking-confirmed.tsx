'use client';

import { EVENT_TYPE_LABELS, formatPrice, type EventType } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import type { WireBooking } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';

/**
 * The column holds the slug; a person reads the label. The stored value is the
 * fallback so a legacy row never renders as nothing (#394).
 */
function occasionLabel(eventType: string | null | undefined): string | null {
  if (!eventType) return null;
  // `hasOwn`, not `??`: a stored `constructor` or `toString` would otherwise
  // read an inherited function off the record and print it on the receipt.
  return Object.hasOwn(EVENT_TYPE_LABELS, eventType)
    ? EVENT_TYPE_LABELS[eventType as EventType]
    : eventType;
}

const EVENT_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The categories offered beside "Still need someone for…".
 *
 * **Names only, no counts.** The revised frame `06` cut the "couples who booked
 * Maya also booked" framing because it needs pairing data the app does not
 * have, and a count here would be exactly the invented number the parity rules
 * forbid on a public surface.
 */
const CROSS_SELL = [
  { label: 'Florals', slug: 'florals' },
  { label: 'Live music', slug: 'live-music' },
  { label: 'Catering', slug: 'catering' },
  { label: 'Cake', slug: 'cake' },
] as const;

export interface BookingConfirmedProps {
  booking: WireBooking;
  vendor: { slug: string; businessName: string; avatarUrl: string | null; city: string | null };
  /** The thread with this vendor, so `Message …` has somewhere to go. */
  conversationId: string | null;
}

/**
 * Frame `06`. The one celebration moment in the product — then straight back to
 * something useful.
 *
 * It is a **state, not a one-shot page**: it is reachable again from the
 * booking detail, so nothing here depends on having just arrived from checkout.
 */
export function BookingConfirmed({
  booking,
  vendor,
  conversationId,
}: BookingConfirmedProps): React.ReactElement {
  const day = EVENT_DAY.format(new Date(`${booking.eventDate}T00:00:00Z`));

  /*
   * The check springs in, once. `prefers-reduced-motion` is honoured by the
   * `motion-reduce` variants below rather than by a media query read in JS —
   * the browser already knows, and asking it twice is how the two answers get
   * to disagree.
   */
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArrived(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    /*
      A labelled region, not a second `<main>`: `app/layout.tsx` already renders
      the page's one `main#main`, and this sat inside it (#411).

      **`app-field`, not `flex-1`.** `flex-1` resolved against `main#main`,
      which is a block, so it did nothing: the field sized to its content at
      514.88px and left 321px of bare `stone-50` below a gradient the frame
      draws full-bleed. It also put the cross-sell chips flush against the
      `overflow:hidden` edge, which cut 4px off all four focus rings, and left
      `justify-center` no slack, so the check circle sat hard against the
      header. `app-field` states the height once, in the theme, against
      `--header-height` — nothing here re-derives 64px.

      It is a **`min-height`**, and deliberately not `app-shell`: this stack
      does not scroll inside itself, so a fixed height would clip it at both
      ends with no scrollbar in any short window or at 200% zoom, which
      `04-laws.md` names as a bug outright. The scroll-budget table lists the
      1.0x surfaces and this screen is not one of them.

      The frame draws no header at all. That is the frame omitting chrome, not
      the screen refusing it: `04-laws.md` fixes the reference viewport at
      1440x900 "with a 64px header", making 836px the budget every app surface
      spends, and law 2 keeps the header fixed rather than scrolled away.
      Recorded in `15-confirmed.md`.

      The gradient is 20% deeper than the frame's transcription. See the
      contrast note on the sub-line below.
    */
    <section
      aria-label="Booking confirmed"
      className="app-field flex flex-col items-center justify-center bg-linear-[150deg,#627653_0%,#4B623E_55%,#3A4E31_100%] px-10"
    >
      {/* The two low-opacity circles the frame draws, and nothing else. */}
      <span
        aria-hidden="true"
        className="absolute -top-[70px] -left-[90px] size-80 rounded-full bg-white/6"
      />
      <span
        aria-hidden="true"
        className="absolute -right-[70px] -bottom-[110px] size-95 rounded-full bg-white/5"
      />

      <span
        aria-hidden="true"
        className={cn(
          'flex size-[70px] items-center justify-center rounded-full bg-white/16 text-[32px] text-stone-0',
          'transition-transform duration-500 ease-[cubic-bezier(.2,1.4,.4,1)] motion-reduce:transition-none',
          arrived ? 'scale-100' : 'scale-75',
        )}
      >
        ✓
      </span>

      {/*
        The date, not the transaction. "Booking confirmed" is a receipt; the
        date is what they bought.
      */}
      <h1 className="display-heading mt-5.5 text-[48px] text-stone-0">{day} is yours.</h1>
      {/*
        **Full `stone-0`, and the ground moved to carry it.** D30 refused a
        large-text carve-out and kept the 4.5:1 floor blanket, which left this
        screen a choice between moving the colour and moving the ground. Both
        moved, each as little as it could: the two dimmed lines over the field
        (this one at .88 and `Still need …` at .75) go to full ink, because the
        floor bans dimming anything that carries meaning; and the gradient
        goes 20% deeper, because white is already the lightest ink the system
        has, so the 48px headline had nowhere else to go.

        **The depth is set by the narrowest width, not by the reference one.**
        A 150deg gradient's line is `0.5W + 0.866H` long, so a narrower field
        is a shorter line and a centred headline spreads across more of it —
        21% of the line at 1440, 35% at 390 — reaching ground the reference
        viewport never shows it. 6.5% deeper cleared 4.62 at 1440 and still
        measured 3.66 at 390, and the floor D30 kept is blanket.

        Worst sample under any text box on this screen, measured: **4.56** at
        320x568, 4.62 at 390x844, 4.81 at 720x450 (400% reflow), 5.68 at
        1024x640, 5.90 at 1440x900. The `✓` is `aria-hidden` and decorative,
        so it is exempt and is not measured. Per-node table in
        `01-foundations.md`.
      */}
      <p className="mt-2.5 max-w-[480px] text-center text-lg leading-prose text-stone-0">
        {vendor.businessName} has been paid into escrow and your booking is confirmed. They&apos;ll
        message you two weeks out to plan the timeline.
      </p>

      {/*
        `flex-wrap` and `max-w-full` are inert at every width the degradation
        table draws and load-bearing below about 500, where the three groups
        stop fitting on one row. The field clips its overflow, so without them
        the booking id — the one thing on this card a support request is
        about — is simply cut off the right edge rather than wrapping. The
        table has no row for this screen, so this is the card refusing to hide
        content rather than a composition invented for a width nothing draws.
      */}
      <div className="mt-7 flex max-w-full flex-wrap items-center justify-center gap-y-4 gap-x-6.5 rounded-[18px] bg-stone-0 px-5.5 py-4.5 shadow-[0_12px_40px_rgba(35,40,38,.2)]">
        <div className="flex items-center gap-3">
          {/*
            The frame draws a 50px square at an 11px radius, not the 64px
            circle this was. `receipt` is the size; the radius comes through
            `className`, which every branch of `Avatar` appends last precisely
            so a caller's override wins over the shared `rounded-full`.
          */}
          <Avatar
            size="receipt"
            name={vendor.businessName}
            src={vendor.avatarUrl}
            className="rounded-[11px]"
          />
          <div>
            <p className="font-display text-[18px] text-stone-900">{vendor.businessName}</p>
            <p className="mt-0.5 text-meta text-stone-600">
              {[occasionLabel(booking.eventType), booking.venue, vendor.city]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <span aria-hidden="true" className="h-11 w-px bg-stone-200" />

        <div>
          <p className="text-label font-semibold tracking-label text-stone-600 uppercase">Paid</p>
          <p className="font-display text-[24px] text-stone-900">
            {formatPrice(booking.totalAmountCents)}
          </p>
        </div>

        <span aria-hidden="true" className="h-11 w-px bg-stone-200" />

        <div>
          <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
            Booking
          </p>
          {/*
            The row id, in mono, as the frame draws it. It is what a support
            request is about, so it is legible and selectable rather than
            decorative.
          */}
          <p className="mt-1 font-mono text-[13px] text-stone-900 select-all">{booking.id}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href={conversationId ? `/messages?conversation=${conversationId}` : '/messages'}
          /*
            `sage-600`, and the frame is the reason it is not an exact match.

            This read a sage 700, which `sage` does not declare — 50, 100, 150,
            200, 300, 400, 600. Tailwind v4 generates a utility only for a step
            the theme defines, so the class emitted **no CSS at all**: verified
            against the served stylesheet, where `sage-700` matches zero rules
            and `text-sage-600` matches one. The label therefore had no colour
            of its own and inherited the body ink — near-black on the cream
            button, where the frame draws deep green.

            Frame `06` draws this button `color:#3A4D33` on `background:#FFFDF9`,
            and `#3A4D33` is **not** a token either. It appears exactly **once**
            in the whole design file, against **72** uses of `#4B5940` — which
            `01-foundations.md:26` declares as `--color-sage-600`, commented
            "sage as text". A value used once, a shade off the value used
            seventy-two times for the same job, is the frame's arithmetic
            drifting rather than a step the system is missing: `#385` records
            that the frames are trustworthy as composition, not as arithmetic.
            So this takes the system's sage-as-text and the deviation is
            recorded here rather than resolved by inventing a `sage-700`.
          */
          /*
            #383. `data-focus-own` on all three controls in this hero, and the
            outline stays.

            The base `:focus-visible` rule is the unbordered treatment for the
            product's cream ground: clay at `/40` over a `stone-50` offset
            band. This section is the one dark surface in the product, and both
            halves of that are wrong on it — clay on deep sage is low contrast,
            and a cream band is a bright halo. `outline-stone-0` is the same
            treatment inverted, and an outline is the right primitive rather
            than a ring because its offset shows the gradient through instead
            of needing a flat colour to match.

            Without the opt-out these painted the outline *and* the base ring.
          */
          data-focus-own
          className="rounded-[10px] bg-stone-0 px-6 py-3.25 text-cta font-semibold text-sage-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
        >
          Message {vendor.businessName}
        </Link>
        <Link
          href="/bookings"
          data-focus-own
          className="rounded-[10px] border border-stone-0/45 px-6 py-3.25 text-cta font-semibold text-stone-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
        >
          View booking
        </Link>
      </div>

      {/*
        `max-w-[600px]`, not `w-[600px]`: the rule is 600 wide wherever 600 fits
        — every width the degradation table draws — and the field clips its
        overflow, so a fixed 600 ran the divider off both edges and cut the
        first and last chip in half below ~680. Same reason the chip row wraps.
      */}
      <div className="mt-7.5 w-full max-w-[600px] border-t border-stone-0/20 pt-5.5 text-center">
        <p className="mb-3 text-sm text-stone-0">Still need someone for {day}?</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {CROSS_SELL.map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}&date=${booking.eventDate}`}
              data-focus-own
              className="rounded-full bg-stone-900/14 px-3.75 py-2 text-sm font-semibold text-stone-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
