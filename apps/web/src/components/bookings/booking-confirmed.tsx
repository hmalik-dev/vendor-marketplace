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
    <main
      aria-label="Booking confirmed"
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-linear-[150deg,#7A9468_0%,#5E7A4E_55%,#49613D_100%] px-10"
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
      <p className="mt-2.5 max-w-[480px] text-center text-base leading-relaxed text-stone-0/88">
        {vendor.businessName} has been paid into escrow and your booking is confirmed. They&apos;ll
        message you before the day to plan the details.
      </p>

      <div className="mt-7 flex items-center gap-6.5 rounded-[18px] bg-stone-0 px-5.5 py-4.5 shadow-[0_12px_40px_rgba(35,40,38,.2)]">
        <div className="flex items-center gap-3">
          <Avatar size="lg" name={vendor.businessName} src={vendor.avatarUrl} />
          <div>
            <p className="font-display text-[18px] text-stone-900">{vendor.businessName}</p>
            <p className="mt-0.5 text-xs text-stone-600">
              {[occasionLabel(booking.eventType), booking.venue, vendor.city]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <span aria-hidden="true" className="h-11 w-px bg-stone-200" />

        <div>
          <p className="text-label text-stone-600">Paid</p>
          <p className="font-display text-[24px] text-stone-900">
            {formatPrice(booking.totalAmountCents)}
          </p>
        </div>

        <span aria-hidden="true" className="h-11 w-px bg-stone-200" />

        <div>
          <p className="text-label text-stone-600">Booking</p>
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
          className="rounded-[10px] bg-stone-0 px-6 py-3.25 text-sm font-semibold text-sage-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
        >
          Message {vendor.businessName}
        </Link>
        <Link
          href="/bookings"
          className="rounded-[10px] border border-stone-0/45 px-6 py-3.25 text-sm font-semibold text-stone-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
        >
          View booking
        </Link>
      </div>

      <div className="mt-7.5 w-[600px] border-t border-stone-0/20 pt-5.5 text-center">
        <p className="mb-3 text-[12.5px] text-stone-0/75">Still need someone for {day}?</p>
        <div className="flex justify-center gap-2.5">
          {CROSS_SELL.map((category) => (
            <Link
              key={category.slug}
              href={`/search?category=${category.slug}&date=${booking.eventDate}`}
              className="rounded-full bg-white/14 px-3.75 py-2 text-[12.5px] font-semibold text-stone-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-stone-0"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
