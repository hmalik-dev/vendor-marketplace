import { addDays } from '@vendor-marketplace/shared';

/**
 * What makes a vendor **new**, for the `New` badge frame `02` draws on a card.
 *
 * **Recency, not a missing review** (#417 item 3). The card used to print `New`
 * whenever `reviewCount` was 0, and the account holder ruled that wrong on
 * 2026-09-06: *"reviewless shouldnt matter, an old vendor can be review less
 * somehow"*. A studio that has been listed for a year and never been reviewed is
 * not new, and telling a customer it is misdescribes it in the one place the
 * customer is comparing vendors side by side.
 *
 * **`vendor_profiles.created_at` is the timestamp used**, and it is the only
 * suitable one on the table: there is no `published_at`, so "when the vendor
 * joined" is when their profile row was written. It is close enough to the
 * ruling to be honest — a profile is created when someone signs up as a vendor
 * — and it needs no migration, which matters because it cannot then be wrong
 * for the rows that already exist.
 *
 * The window is a **starting point stated by the ticket**, not a measured one.
 * It lives here rather than beside the query so both card producers read one
 * number, and so changing it is one edit with one test behind it.
 */
export const NEW_VENDOR_WINDOW_DAYS = 30;

/**
 * Computed here rather than in SQL, so it is a pure function with a test that
 * needs no database — and so both DAOs answer the question the same way rather
 * than each carrying its own interval expression.
 *
 * **`now` is required, not defaulted.** Both callers ask this once per row of a
 * page, so a default would read the clock inside the loop — one `Date` per
 * vendor, and a page whose rows are answered at N slightly different moments.
 * More than that, it would be the *wrong* clock: `plugins/clock.ts` exists so
 * every "now" in a request has one named source, after "today" was once decided
 * in two places that did not have to agree. This instant comes from
 * `app.clock()` at the route, which is what lets a test pin the badge.
 */
export function isNewVendor(createdAt: Date, now: Date): boolean {
  // The shared `addDays`, not a private millisecond constant — day arithmetic
  // has one home in this codebase and `shared-contracts.md` keeps it there.
  return createdAt.getTime() > addDays(now, -NEW_VENDOR_WINDOW_DAYS).getTime();
}
