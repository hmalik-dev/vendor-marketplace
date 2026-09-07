import Link from 'next/link';
import { ADMIN_CASE_BOOKING_FILTERS, SUPPORT_CASE_STATUSES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminCases } from '@/lib/admin-data';
import { CASE_PRESENTATION, caseSubject } from '@/lib/case-presentation';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/cases';

const FILED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * How long a case has been waiting, in whole days.
 *
 * The number the screen exists for, and it is computed rather than stored: the
 * age of the oldest open case is money somebody is not being paid, and a column
 * holding it would be wrong the moment nobody wrote to it. Whole days because
 * that is the granularity an operator acts on — nothing changes between "four
 * hours" and "seven hours", and everything changes at "eleven days".
 */
function ageInDays(createdAt: Date, now: number): number {
  return Math.max(0, Math.floor((now - createdAt.getTime()) / 86_400_000));
}

/**
 * The case queue (#431) — one inbox for every dispute, however it arrived.
 *
 * **Open and oldest first, by default and on the server.** `adminCaseQuerySchema`
 * defaults `status` to `open` and the DAO orders ascending, so the screen an
 * operator lands on is the one showing the row that has been waiting longest.
 * Every other console list is newest-first; this one is not, and the difference
 * is the feature rather than an inconsistency.
 */
export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: RawParam; booking?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  const status = oneOf(raw.status, SUPPORT_CASE_STATUSES);
  const booking = oneOf(raw.booking, ADMIN_CASE_BOOKING_FILTERS);
  const dropped = droppedKeys(raw, { status, booking });
  const cases = await getAdminCases(
    adminQueryString({ status, booking, page: pageNumber(raw.page) }),
  );

  /*
   * One clock read for the whole table, not one per row. Rendering is not
   * instantaneous, and a per-row `Date.now()` would let two rows filed in the
   * same second show different ages.
   */
  const now = Date.now();
  /*
   * **Page one only.** `items[0]` is the oldest row of *this page*, and the
   * list is paginated — so on page two the count line would have printed
   * `oldest 3d` while the genuinely oldest open case, forty days old on page
   * one, is the number the screen exists to show. A figure that is wrong on
   * every page but the first is worse than one that is only shown once.
   */
  const oldest = cases.page === 1 ? cases.items[0] : undefined;
  const showing = status ?? 'open';

  const empty =
    booking && showing === 'open'
      ? {
          headline:
            booking === 'with' ? 'No open cases about a booking' : 'No open general questions',
          description: 'Clear the filter to see every open case.',
        }
      : showing === 'resolved'
        ? {
            headline: 'Nothing resolved yet',
            description: 'A case is resolved when an operator rules on it.',
          }
        : {
            headline: 'Nothing waiting',
            description:
              'A case appears here when somebody reports a problem or a card network opens a chargeback.',
          };

  return (
    <AdminSurface
      heading="Cases"
      /*
       * The oldest open case's age sits in the count line, because it is the
       * number the screen is for. Only on the open list: "the oldest resolved
       * case is 40 days old" measures nothing.
       */
      counts={[
        `${cases.total} ${showing}`,
        ...(showing === 'open' && oldest ? [`oldest ${ageInDays(oldest.createdAt, now)}d`] : []),
      ]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH}>
          {/*
            `allowAny={false}`, and it is the only filter in the console that
            says so. `adminCaseQuerySchema` defaults `status` to `open` — the
            queue's whole reason to exist is showing what is waiting — so
            clearing the parameter lands back on open rather than widening the
            list. The `Any status` choice every other filter offers would have
            been a control that read as a reset and did nothing.
          */}
          <FilterSelect
            action={PATH}
            carried={{ booking }}
            name="status"
            label="Status"
            allowAny={false}
            value={status ?? 'open'}
            options={SUPPORT_CASE_STATUSES.map((value) => ({
              value,
              label: CASE_PRESENTATION[value].label,
            }))}
          />
          <FilterSelect
            action={PATH}
            carried={{ status }}
            name="booking"
            label="Booking"
            value={booking ?? ''}
            options={[
              { value: 'with', label: 'About a booking' },
              { value: 'without', label: 'General' },
            ]}
          />
        </FilterBar>
      }
      pager={{
        path: PATH,
        params: { status, booking },
        page: cases.page,
        pageSize: cases.pageSize,
        total: cases.total,
      }}
    >
      <DataTable
        rows={cases.items}
        rowKey={(row) => row.id}
        empty={<EmptyState headline={empty.headline} description={empty.description} />}
        columns={[
          {
            key: 'reference',
            width: '1.1fr',
            header: 'Reference',
            className: 'font-mono font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`${PATH}/${row.id}`} className="hover:underline">
                {row.reference}
              </Link>
            ),
          },
          {
            key: 'who',
            width: '1.4fr',
            header: 'Who',
            /*
             * The name where the sender has an account, the reply-to address
             * where they do not, and `—` for a chargeback with neither. Three
             * genuinely different states rather than one blank.
             */
            cell: (row) =>
              row.senderName ?? row.senderEmail ?? <span className="text-stone-600">—</span>,
          },
          { key: 'subject', width: '1.2fr', header: 'Subject', cell: caseSubject },
          {
            key: 'booking',
            width: '1fr',
            header: 'Booking',
            /*
             * Text, not a link. It said `Linked` and pointed at the unfiltered
             * booking list, which drops an operator into every booking the
             * platform has ever taken with no way back to the one under dispute.
             * `/admin/bookings` has no by-id filter to point at, and the case
             * detail — one click away on the reference — carries the booking in
             * full. A link that loses you is worse than a word that does not
             * move.
             */
            cell: (row) => (row.bookingId ? 'Linked' : <span className="text-stone-600">—</span>),
          },
          {
            key: 'age',
            width: '.8fr',
            header: 'Age',
            className: 'font-mono',
            cell: (row) => `${ageInDays(row.createdAt, now)}d`,
          },
          {
            key: 'filed',
            width: '1fr',
            header: 'Filed',
            cell: (row) => FILED.format(row.createdAt),
          },
          {
            key: 'status',
            width: '.9fr',
            header: 'Status',
            cell: (row) => (
              <StatusPill tone={CASE_PRESENTATION[row.status].tone}>
                {CASE_PRESENTATION[row.status].label}
              </StatusPill>
            ),
          },
        ]}
      />
    </AdminSurface>
  );
}
