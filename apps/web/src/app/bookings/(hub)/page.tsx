import type { Metadata } from 'next';
import { pageTitle, toDateString } from '@vendor-marketplace/shared';
import { BookingsHub, BOOKING_TABS } from '@/components/bookings/bookings-hub';
import { BookingsRail } from '@/components/bookings/bookings-rail';
import { BookingsSidebar } from '@/components/bookings/bookings-sidebar';
import { BOOKING_SORTS, toEntries, type BookingSort, type BookingTab } from '@/lib/booking-entries';
import { getOwnBookingRequests, getOwnBookings } from '@/lib/customer-data';
import { getOwnConversations } from '@/lib/messaging-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your bookings'),
  robots: { index: false, follow: false },
};

/**
 * Never prerendered. The `loading.tsx` beside this file gives Next a shell it
 * could otherwise try to statically generate, and this page resolves the signed-in
 * customer before it can render anything — which is not a question a build has an
 * answer to.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    tab?: string | string[];
    category?: string | string[];
    sort?: string | string[];
  }>;
}

/**
 * Next yields an **array** for a repeated key — `?category=a&category=b` — so
 * every one of these is `string | string[]` before it is anything else.
 *
 * It is not cosmetic. `query.category.trim()` on an array throws during the
 * server render, and that happens *above* the `requireRole` call below, so a
 * signed-out visitor following such a link got an error boundary where they
 * should have got the sign-in redirect. `/messages` already takes the first
 * value for the same reason.
 */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTab(value: string | undefined): value is BookingTab {
  return (BOOKING_TABS as readonly string[]).includes(value ?? '');
}

function isSort(value: string | undefined): value is BookingSort {
  return (BOOKING_SORTS as readonly string[]).includes(value ?? '');
}

/**
 * Frame `07` — one standing home for every vendor booking the customer makes.
 *
 * **The page itself does not scroll**; the list pane and the rail scroll
 * independently, which is what keeps the summary and the tabs in place while
 * a long history is read.
 */
export default async function BookingsPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const query = await searchParams;
  const tab: BookingTab = isTab(first(query.tab)) ? (first(query.tab) as BookingTab) : 'upcoming';
  /*
   * Both refinements fall back rather than 404: an unrecognised `?sort=` is a
   * stale link, and `applyRefinements` drops a `?category=` this customer has no
   * bookings under, so neither can strand them on an empty hub they cannot
   * explain.
   */
  const rawSort = first(query.sort);
  const sort: BookingSort = isSort(rawSort) ? rawSort : 'soonest';
  /*
   * Trimmed, then used — the trimmed value is what the hub matches against its
   * category list, so `?category=%20Catering%20` filters rather than silently
   * missing.
   */
  const rawCategory = first(query.category)?.trim();
  const category = rawCategory ? rawCategory : null;

  /*
   * The tab travels through sign-in, so a link to a specific tab still lands on
   * that tab afterwards. Only the validated value is carried — an unrecognised
   * `?tab=` is already dropped above and must not be reintroduced by the
   * return trip.
   */
  const user = await requireRole('customer', `/bookings?tab=${tab}`);

  const [requests, bookings, conversations] = await Promise.all([
    getOwnBookingRequests(),
    getOwnBookings(),
    /*
     * Frame `07`'s rail draws the three most recent threads. It fails soft on its
     * own — an unreachable messaging API costs the rail's second block, not the
     * page — so it is fetched alongside rather than gated behind the bookings.
     */
    getOwnConversations(),
  ]);
  const entries = toEntries(requests, bookings);
  /*
   * The UTC day, not this process's local one (#409, #391). `todayDateString`
   * reads the *caller's* wall clock and says in its own contract that it is
   * only ever meaningful on the client; called here it returned whatever day
   * the web host was on, which is neither the customer's nor the API's.
   *
   * The upcoming/history split and the "next up in N days" line are a
   * server-rendered grouping, so they take the clock a server can defend —
   * #391's ruling. The surfaces where a viewer's own day is the answer are
   * anchored on it: the availability calendar, the dashboard's week strip and
   * every date picker's floor.
   */
  const today = toDateString(new Date());

  // Clay is reserved for the reader's own move, and a quote is exactly that.
  const needsYou = entries.filter((entry) => entry.status === 'quoted');

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <BookingsSidebar bookingCount={entries.length} current="bookings" />
      <BookingsHub
        entries={entries}
        tab={tab}
        today={today}
        city={user.city}
        needsYou={needsYou}
        category={category}
        sort={sort}
      />
      <BookingsRail
        needsYou={needsYou}
        hasBookings={entries.length > 0}
        conversations={conversations}
      />
    </div>
  );
}
