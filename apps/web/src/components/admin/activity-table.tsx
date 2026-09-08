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
 *
 * **The clock is 24-hour, drawn by Pattern A of the admin delta (#454)** —
 * `7 Sep 2026, 14:02`. Absolute to the minute, never relative: an audit trail
 * that rounds is not an audit trail, and `2:02 PM` is a form a reader has to
 * disambiguate before they can compare two rows.
 *
 * Two differences from the frame are deliberate and are recorded as live
 * overrides in `.claude/rules/web-design-parity.md`. It draws `7 Sep` and this
 * prints `Sep 7` — `31-content-voice.md` rules the product US English and the
 * frame's order is the British form. And it draws no zone, which is a mock
 * timestamp rather than a ruling against one; the reason the zone is here is
 * unaddressed by the frame and still holds.
 */
const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
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
  user_data_exported: 'Exported an account record',
  user_closed: 'Closed an account',
  /*
   * Graduated moderation (#435). Written in the same register as the seven above
   * — what the operator did, past tense — and deliberately **not** using the
   * word "suspended" for any of them, because none of these is a ban and the
   * activity feed is where a reader reconstructs which happened.
   *
   * "Unhid", not "Showed again": the console says *unhide* in the menu item,
   * the dialog title, its body and its confirm button, and a feed that renames
   * the action afterwards is a second name for one thing.
   */
  vendor_unpublished: 'Unpublished a storefront',
  vendor_republished: 'Republished a storefront',
  review_hidden: 'Hid a review',
  review_unhidden: 'Unhid a review',
  package_deactivated: 'Deactivated a package',
  package_reactivated: 'Reactivated a package',
  portfolio_item_removed: 'Removed a portfolio photo',
  conversation_messages_read: 'Read a reported thread',
};

/** The noun the subject id points at, so a bare uuid says what it is. */
const SUBJECT_LABELS: Record<AdminActionSubject, string> = {
  user: 'Account',
  review: 'Review',
  tag: 'Tag',
  tag_suggestion: 'Suggestion',
  booking: 'Booking',
  support_case: 'Case',
  vendor_profile: 'Storefront',
  service_package: 'Package',
  portfolio_item: 'Photo',
  conversation: 'Thread',
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
  /**
   * The counted filtered-empty state (#454), supplied by the page.
   *
   * Here rather than built inside this component because the words on each
   * widening button are the *screen's* copy — "Any operator", "Any action" —
   * and this table has no business knowing them. It still owns the **true**
   * empty below, which is one sentence about where rows come from and carries
   * no button at all.
   */
  filteredEmpty?: React.ReactNode;
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
export function ActivityTable({
  rows,
  path,
  filtered,
  filteredEmpty,
}: ActivityTableProps): React.ReactElement {
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
        filtered && filteredEmpty ? (
          filteredEmpty
        ) : (
          /*
           * **True empty carries no button.** Nothing an operator does creates
           * an activity row, so a control here would offer an action that
           * cannot help; the copy's only job is to say where rows come from, so
           * the silence reads as calm rather than broken.
           */
          <EmptyState
            headline={filtered ? 'Nothing matches that filter' : 'No console activity yet'}
            description={
              filtered
                ? 'Clear the filter to see everything the console has done.'
                : 'Every suspension, deletion and ruling an operator makes is recorded here.'
            }
          />
        )
      }
      /*
       * Pattern A's grid (#454), with `What changed` kept and `When` last.
       *
       * The delta lists four columns — `Actor · Action · Subject · When` — and
       * `What changed` was ruled back in on 2026-09-07: the paragraph that
       * forbids rounding a timestamp forbids this harder, because a trail
       * recording *that* something changed but not *what* fails the same test.
       * The bundle was written at pattern level and the column was not
       * considered. Its width is the one it already had; the delta draws none.
       *
       * `Actor`, not `Operator`: the delta names the column, and the log
       * records actions taken by the platform's own sweeps as well as by
       * people.
       */
      columns={[
        {
          key: 'actor',
          width: '1.2fr',
          header: 'Actor',
          className: 'font-semibold text-stone-900',
          cell: ({ row, actorHref }) => (
            <Link href={actorHref} className="hover:underline">
              {row.actorName}
            </Link>
          ),
        },
        {
          key: 'action',
          width: '1fr',
          header: 'Action',
          cell: ({ row }) => ACTION_LABELS[row.action],
        },
        {
          key: 'subject',
          width: '1.6fr',
          header: 'Subject',
          /*
           * Type and id in **one** cell, and typographically distinct within
           * it: the type in `stone-600` and the id in mono `stone-900`, which
           * is what lets the eye sort by type down the column while the id
           * still looks like something you would paste into a support thread.
           * The cell was uniformly mono `stone-700`, so `Booking` and its uuid
           * read as one undifferentiated string.
           */
          cell: ({ row, subjectHref }) => (
            <Link href={subjectHref} className="hover:underline" title={row.subjectId}>
              <span className="text-stone-600">{SUBJECT_LABELS[row.subjectType]}</span>{' '}
              <span className="font-mono text-stone-900">{shortId(row.subjectId)}</span>
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
        {
          key: 'when',
          width: '.9fr',
          header: 'When',
          className: 'text-stone-900',
          cell: ({ when }) => when,
        },
      ]}
    />
  );
}
