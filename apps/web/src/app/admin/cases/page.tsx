import Link from 'next/link';
import { ADMIN_CASE_BOOKING_FILTERS, SUPPORT_CASE_STATUSES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { DataTable } from '@/components/admin/data-table';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { getAdminCases } from '@/lib/admin-data';
import { ageInDays, ageTone, CASE_PRESENTATION, caseSubject } from '@/lib/case-presentation';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/cases';

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

  /*
   * The filters currently narrowing the view, in the order the bar shows them.
   *
   * **`status` is a switch, not a drop, and this queue is the only screen where
   * that is true.** `adminCaseQuerySchema` defaults it to `open`, so clearing
   * the parameter lands back on open — which is exactly why the filter bar
   * offers no "any status", and an `Any status` widening would be the same
   * control the bar deliberately does not have: on the default view it would
   * link straight back to the empty page it was offered from. So it navigates
   * to the *other* status and the API counts that status, which is what the
   * delta's own worked example draws — `Open cases instead (4)`, seen from a
   * resolved view.
   *
   * `booking` is a genuine drop, and is only active when it was set.
   */
  const other = showing === 'open' ? 'resolved' : 'open';
  const active: ActiveFilter[] = [
    {
      key: 'status',
      widening: `${CASE_PRESENTATION[other].label} cases instead`,
      carried: { status: other, booking },
    },
    ...(booking
      ? [
          {
            key: 'booking',
            widening: 'Any kind',
            carried: { status },
          },
        ]
      : []),
  ];

  /*
   * The heading recites the filters as the operator set them, which is why it
   * is written here rather than assembled from fragments inside the component:
   * a generic join reads "No resolved and about a booking cases", and this
   * sentence is the part of the state that has to sound like a person wrote it.
   */
  const filteredHeadline = booking
    ? `No ${showing} cases ${booking === 'with' ? 'about a booking' : 'that are general questions'}`
    : `No ${showing} cases`;

  /*
   * **True empty carries no button** — the delta is explicit, and this is the
   * screen it says it about. Nothing an operator does creates a case, so a
   * control here would offer an action that cannot help; the copy's whole job
   * is to say where cases come from, so the silence reads as calm rather than
   * broken.
   *
   * `widenings` is what tells the two apart, and it is the honest test: the API
   * returns routes only when a filter is narrowing the view *and* widening one
   * would reveal something. A list that is empty because the platform has no
   * cases gets none, whatever the URL says.
   */
  const trueEmpty = {
    headline: 'Nothing is disputed',
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
        empty={
          /*
           * Filtered-empty when a filter is narrowing the view, true empty when
           * the platform simply has no cases. `widenings.length > 0` decides it
           * on its own for the ordinary case — the API only counts routes that
           * exist — and the two explicit parameters cover the one it cannot:
           * an operator who set both filters, where widening either *alone*
           * still finds nothing. That state has a heading and an escape to
           * offer even with no counted route.
           *
           * `status`, not `raw.status`: the parsed value, like every other read
           * on this page. `?status=nonsense` is a parameter the screen has
           * already told the operator it ignored (`dropped`), so treating it as
           * a filter would put the *filtered*-empty copy on a view nothing is
           * filtering.
           */
          cases.widenings.length > 0 || status !== undefined || booking !== undefined ? (
            <FilteredEmpty
              headline={filteredHeadline}
              path={PATH}
              filters={active}
              widenings={cases.widenings}
            />
          ) : (
            <EmptyState headline={trueEmpty.headline} description={trueEmpty.description} />
          )
        }
        columns={[
          {
            key: 'reference',
            width: '.9fr',
            header: 'Reference',
            className: 'font-mono font-semibold text-stone-900',
            cell: (row) => (
              <Link href={`${PATH}/${row.id}`} className="hover:underline">
                {row.reference}
              </Link>
            ),
          },
          {
            key: 'sender',
            width: '1.2fr',
            header: 'Sender',
            /*
             * The name where the sender has an account, the reply-to address
             * where they do not, and `—` for a chargeback with neither. Three
             * genuinely different states rather than one blank.
             *
             * `Sender` rather than `Who`, per Pattern A. The delta draws the
             * dash at `.dz` — `#C9C1B5`, which is this theme's `stone-500` —
             * and it stays `stone-600` here: the token is annotated *disabled
             * text ONLY, fails AA by design*, and this dash is the entire
             * content of the cell rather than an adornment beside something
             * legible. Recorded as a live override in `web-design-parity.md`.
             */
            cell: (row) =>
              row.senderName ?? row.senderEmail ?? <span className="text-stone-600">—</span>,
          },
          { key: 'subject', width: '1.8fr', header: 'Subject', cell: caseSubject },
          {
            key: 'booking',
            width: '.9fr',
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
            width: '.6fr',
            header: 'Age',
            className: 'font-mono',
            cell: (row) => {
              const days = ageInDays(row.createdAt, now);

              return <span className={ageTone(days)}>{days}d</span>;
            },
          },
          /*
           * `Filed` is gone, and Age is what replaces it.
           *
           * Pattern A draws six columns and this was the seventh. The absolute
           * date is not lost — the case detail opens on `opened 4 Sep 2026,
           * 09:12` — and unlike `/admin/activity`, which keeps `What changed`
           * because an audit trail that drops data is not an audit trail, this
           * is a work queue: the question it answers is *how long has this been
           * waiting*, which is the column that now carries a colour.
           */
          {
            key: 'status',
            width: '.8fr',
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
