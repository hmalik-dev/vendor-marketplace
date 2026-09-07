/**
 * The landing page's trust band copy.
 *
 * **The signed-in status strip was removed on 2026-09-07 and this file is what
 * is left of it.** #428 built a `Next up — <vendor>, <date>` strip above the
 * hero, derived from the customer's own bookings. The account holder ruled it
 * out for a reason worth keeping: **a customer can have several upcoming
 * bookings, so a single "next up" implies there is one.** Featuring the soonest
 * is an arbitrary choice presented as a fact, and the bookings hub already
 * shows all of them without having to pick.

 * Removed with it: `landingStatus`, `hasStatusStrip`, `LandingStatus`, the
 * `status-strip` component and its tests, and the two per-customer reads
 * `page.tsx` made to feed them — the signed-in landing now fetches no
 * booking data at all.
 */

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

/*
 * `trustCopyFor` is gone — the band stays GENERIC on the signed-in page too.
 *
 * #428 resolved the guarantees against the reader's own booking: "Your $2,050
 * for June Harlow Photography is held by Stripe until June 14, 2026." The
 * account holder ruled on 2026-09-07 that it can stay generic, so the resolver,
 * its three tests and the branch in `page.tsx` are removed rather than left
 * unreachable.
 *
 * `GENERIC_TRUST_COPY` is now the only trust copy there is, which is why it is
 * still exported and still a single list: the whole reason it was extracted was
 * that a second literal is how two renderings of the same three guarantees come
 * to drift.
 *
 * Worth keeping in mind if it is ever reinstated: the resolved version must not
 * invent a pronoun for the vendor. A business name says nothing about how the
 * people behind it are addressed, and the frame's "released to her" was written
 * against a fictional vendor rather than as a rule the product can apply.
 */
