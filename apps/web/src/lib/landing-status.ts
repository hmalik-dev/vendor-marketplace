import { BRAND_NAME, formatPrice, isUniversallyPastDate } from '@vendor-marketplace/shared';
import { formatEventDate } from './booking-entries';
import type { WireBooking, WireBookingRequest } from './wire-schemas';

/**
 * What the signed-in landing knows about the customer looking at it.
 *
 * The strip above the hero and the trust band below it are two renderings of
 * the same two facts, so they are derived once: a strip that says a booking is
 * coming while the band underneath falls back to generic copy is one page
 * disagreeing with itself.
 *
 * Both fields are deliberately narrow. This is a *marketing* route that happens
 * to have a reader — it is not the bookings hub, and anything richer here would
 * be a second, thinner copy of `20-customer-bookings-hub.md`'s surface.
 */
export interface LandingStatus {
  /**
   * The soonest confirmed booking still ahead, or `null`.
   *
   * A confirmed booking, never a request: the sage dot means *settled*
   * (`40-states.md`), and money is only held once a request has been paid for.
   */
  readonly next: {
    readonly vendorName: string;
    /** `YYYY-MM-DD`. */
    readonly eventDate: string;
    readonly totalAmountCents: number;
  } | null;
  /**
   * How many of this customer's requests are still waiting on a vendor.
   *
   * `pending` only. A `quoted` request is waiting on the **customer**, and gold
   * means "waiting on someone" rather than "waiting on you" — counting both
   * would put a request the customer has to act on behind a label telling them
   * somebody else is holding it up.
   */
  readonly requestsWaitingOnVendor: number;
}

/**
 * The two facts the signed-in landing renders, from the customer's own rows.
 *
 * `isUniversallyPastDate` rather than the server's own day, per #409: this runs
 * on the server, which cannot know the reader's day. Widening the boundary
 * keeps this evening's booking listed as "next up" for a reader west of UTC
 * instead of vanishing from a page that is supposed to be showing it to them.
 */
export function landingStatus(
  requests: readonly WireBookingRequest[],
  bookings: readonly WireBooking[],
  now: Date = new Date(),
): LandingStatus {
  /*
   * The booking read model carries no vendor name — every booking was a request
   * first, and that request row survives being paid — so the name rides across
   * on the vendor the two share. The same join `toEntries` makes, for the same
   * reason.
   */
  const nameByVendorId = new Map(
    requests.map((request) => [request.vendorId, request.vendor.businessName]),
  );

  const next =
    bookings
      .filter(
        (booking) =>
          booking.status === 'confirmed' && !isUniversallyPastDate(booking.eventDate, now),
      )
      .toSorted((left, right) => left.eventDate.localeCompare(right.eventDate))[0] ?? null;

  const requestsWaitingOnVendor = requests.filter(
    (request) => request.status === 'pending' && !isUniversallyPastDate(request.eventDate, now),
  ).length;

  return {
    next:
      next === null
        ? null
        : {
            // A booking whose request the API did not return is still a real
            // commitment; it is named generically rather than dropped.
            vendorName: nameByVendorId.get(next.vendorId) ?? 'your vendor',
            eventDate: next.eventDate,
            totalAmountCents: next.totalAmountCents,
          },
    requestsWaitingOnVendor,
  };
}

/**
 * Whether the strip has anything to say.
 *
 * Here rather than beside the component it guards, and that is not a filing
 * preference: `status-strip.tsx` is a Client Component, and a function exported
 * from a `'use client'` module cannot be *called* on the server — only rendered
 * or passed as a prop. Declared there, `page.tsx` asking this question threw
 * *"Attempted to call hasStatusStrip() from the server"* and took the whole
 * signed-in landing to the error boundary. jsdom does not enforce the boundary,
 * so the suite was green; the browser pass is what found it.
 *
 * The page has to be able to ask **before** rendering anyway: "omit the strip
 * entirely when the customer has no bookings and no open requests" is a rule
 * about the page's composition, not about the component's internals.
 */
export function hasStatusStrip(status: LandingStatus): boolean {
  return status.next !== null || status.requestsWaitingOnVendor > 0;
}

/**
 * The three guarantees the band states, as titles.
 *
 * A closed set rather than free strings, because the title is also the **key**
 * `page.tsx` hangs each signal's glyph on. Keyed by title so the band can
 * reorder — the signed-in page leads with the payment — but a string key with
 * an open type means a legitimate copy edit here, updated in this file's own
 * test, silently hands the payment guarantee somebody else's icon with the
 * suite green. As a union it fails `tsc` instead.
 */
export const TRUST_TITLES = [
  'Reviews from real bookings',
  'Payment held until the event',
  'No service fee',
] as const;
export type TrustTitle = (typeof TRUST_TITLES)[number];

/** One trust signal, as the band renders it. */
export interface TrustCopy {
  readonly title: TrustTitle;
  readonly body: string;
}

/**
 * The generic band — what a visitor reads, and the fallback for a customer with
 * no booking to resolve against.
 *
 * Exported so `page.tsx` has one list rather than two: the signed-out page and
 * the unresolved signed-in page render the identical three signals, and a
 * second literal is how those two come to drift.
 */
export const GENERIC_TRUST_COPY: readonly TrustCopy[] = [
  {
    title: 'Reviews from real bookings',
    body: 'Every review comes from a booking that actually happened. There is no other way to leave one.',
  },
  {
    title: 'Payment held until the event',
    body: 'Stripe holds your payment until your event is complete, then releases it to the vendor.',
  },
  {
    title: 'No service fee',
    body: 'Vendors publish what they charge, and nothing is added on top of it at checkout.',
  },
] as const;

/**
 * The same three guarantees, said about the booking the reader actually has.
 *
 * The band stays on the signed-in page — a deliberate reversal recorded in
 * frame `30 Landing full page — signed in` — because it states standing
 * guarantees rather than explaining a process, and "payment held until the
 * event" matters *more* to someone with money in flight than to a visitor. What
 * changes is that the guarantees stop being abstract.
 *
 * **Payment leads here**, where the visitor's band leads with reviews: the
 * reader has a charge outstanding, and that is the guarantee they are carrying.
 *
 * `BRAND_NAME`, never the literal — the frames draw the name, the product reads
 * it.
 *
 * No pronoun is invented for the vendor. A business name says nothing about how
 * the people behind it are addressed, and the frame's "released to her" is
 * copy-writing against a fictional vendor rather than a rule the product can
 * apply to a real one.
 */
export function trustCopyFor(status: LandingStatus): readonly TrustCopy[] {
  const booking = status.next;

  if (booking === null) {
    return GENERIC_TRUST_COPY;
  }

  const eventDate = formatEventDate(booking.eventDate);

  return [
    {
      title: 'Payment held until the event',
      body: `Your ${formatPrice(booking.totalAmountCents)} for ${booking.vendorName} is held by Stripe until ${eventDate}, then released to them.`,
    },
    {
      title: 'Reviews from real bookings',
      body: `You can review ${booking.vendorName} once ${eventDate} has passed. Every review on ${BRAND_NAME} comes from a booking that happened.`,
    },
    /*
     * Unchanged, and generic on purpose: there is nothing booking-specific to
     * say about a fee that is not charged.
     */
    GENERIC_TRUST_COPY[2] as TrustCopy,
  ];
}
