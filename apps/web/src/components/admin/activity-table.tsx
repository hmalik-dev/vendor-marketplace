import Link from 'next/link';
import type { AdminAction, AdminActionSubject } from '@vendor-marketplace/shared';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { adminQueryString } from '@/lib/admin-params';
import type { WireAdminActivityRow } from '@/lib/wire-schemas';

/**
 * The year and the zone are both load-bearing here, and neither is decoration.
 *
 * Every neighbouring console formatter prints month/day/**year**; this one
 * dropped the year to make room for a time, so two rows a year apart read
 * identically — on the one screen whose entire value is "who did what **and
 * when**". And the console renders in UTC throughout, so a timestamp quoted
 * out of this table into a support thread is off by the reader's offset unless
 * the zone travels with it.
 */
const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/**
 * What the operator did, in their words rather than the column's.
 *
 * `user_banned` is the enum member the row stores and the filter sends; this is
 * what an operations table should read as. Keyed by the enum so a member added
 * without a label here is a type error rather than a raw `tag_updated` on
 * screen.
 */
export const ACTION_LABELS: Record<AdminAction, string> = {
  user_banned: 'Suspended an account',
  user_unbanned: 'Reinstated an account',
  review_deleted: 'Deleted a review',
  tag_updated: 'Edited a tag',
  tag_suggestion_resolved: 'Resolved a tag suggestion',
  dispute_resolved: 'Resolved a report',
  support_case_resolved: 'Closed a case',
  payout_retried: 'Retried a payout',
};

/** The noun the subject id points at, so a bare uuid says what it is. */
const SUBJECT_LABELS: Record<AdminActionSubject, string> = {
  user: 'Account',
  review: 'Review',
  tag: 'Tag',
  tag_suggestion: 'Suggestion',
  booking: 'Booking',
  support_case: 'Case',
};

/**
 * The detail payload, printed as the flat `key value` pairs it is.
 *
 * No formatting per action, deliberately. Each one carries a handful of counts
 * and enum members chosen by the service that wrote it, and a per-action
 * renderer here would be a second place that has to know what each row means —
 * which is how the two come to disagree about a row written months ago.
 *
 * **`false` prints.** It used to be filtered out alongside `null`, on the
 * reasoning that `profileUnpublished` reads better bare than as
 * `profileUnpublished false` — but that hid the whole content of some rows: a
 * tag deactivation records `isActive false` and nothing else, so it rendered as
 * an em dash, and a ban that unpublished no storefront became indistinguishable
 * from one that did. It was also inconsistent with itself, since `0` printed
 * throughout. `null` is still dropped, because it means "not applicable here"
 * rather than "no".
 */
function detailLine(detail: WireAdminActivityRow['detail']): string {
  return Object.entries(detail)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(' · ');
}

/** The first segment of a uuid — enough to recognise, short enough to scan. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

export interface ActivityTableProps {
  rows: readonly WireAdminActivityRow[];
  /** The surface's own path, so a cell can filter by what it names. */
  path: string;
  filtered: boolean;
}

/**
 * The action log's table.
 *
 * A Server Component, unlike `ReviewTable` and `TagTable`: there is nothing to
 * do to a row here. The log is append-only, so a console that offered an action
 * on one of these rows would be offering something the database refuses.
 *
 * The two id cells are **links that filter by themselves**, which is what makes
 * the subject filter reachable without a dropdown of every uuid the platform
 * holds. "What else did this operator do" and "what else happened to this
 * account" are one click from any row.
 */
export function ActivityTable({ rows, path, filtered }: ActivityTableProps): React.ReactElement {
  /*
   * Everything each cell needs, computed once per row.
   *
   * `DataTableColumn.cell` is called **twice** per row — the grid branch and
   * the card branch both render, and CSS picks one — so formatting a date and
   * building two `URLSearchParams` inside a cell does all of it twice. Its own
   * doc comment asks callers not to; this is that.
   */
  const prepared = rows.map((row) => ({
    row,
    when: WHEN.format(row.createdAt),
    detail: detailLine(row.detail) || '—',
    actorHref: `${path}${adminQueryString({ actor: row.actorId })}`,
    subjectHref: `${path}${adminQueryString({ subject: row.subjectId })}`,
  }));

  return (
    <DataTable
      rows={prepared}
      rowKey={({ row }) => row.id}
      empty={
        <EmptyState
          headline={filtered ? 'Nothing matches that filter' : 'No console activity yet'}
          description={
            filtered
              ? 'Clear the filter to see everything the console has done.'
              : 'Every suspension, deletion and ruling an operator makes is recorded here.'
          }
        />
      }
      columns={[
        {
          key: 'when',
          width: '1.3fr',
          header: 'When',
          className: 'text-stone-900',
          cell: ({ when }) => when,
        },
        {
          key: 'actor',
          width: '1.1fr',
          header: 'Operator',
          className: 'font-semibold text-stone-900',
          cell: ({ row, actorHref }) => (
            <Link href={actorHref} className="hover:underline">
              {row.actorName}
            </Link>
          ),
        },
        {
          key: 'action',
          width: '1.4fr',
          header: 'Action',
          cell: ({ row }) => ACTION_LABELS[row.action],
        },
        {
          key: 'subject',
          width: '1.2fr',
          header: 'Subject',
          className: 'font-mono text-stone-700',
          cell: ({ row, subjectHref }) => (
            <Link href={subjectHref} className="hover:underline" title={row.subjectId}>
              {SUBJECT_LABELS[row.subjectType]} {shortId(row.subjectId)}
            </Link>
          ),
        },
        {
          key: 'detail',
          width: '1.7fr',
          header: 'What changed',
          className: 'text-stone-600',
          cell: ({ detail }) => detail,
        },
      ]}
    />
  );
}
