import Link from 'next/link';
import {
  ADMIN_ACTION_SUBJECTS,
  ADMIN_ACTIONS,
  ADMIN_ACTIVITY_RANGES,
  type AdminActivityRange,
} from '@vendor-marketplace/shared';
import { ACTION_LABELS, ActivityTable, SUBJECT_LABELS } from '@/components/admin/activity-table';
import { AdminSurface } from '@/components/admin/admin-surface';
import { ExportCsvLink } from '@/components/admin/export-csv-link';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { OutOfRange } from '@/components/admin/out-of-range';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { getAdminActivity, getAdminActivityActors } from '@/lib/admin-data';
import { activityParams } from '@/lib/admin-list-params';
import { adminQueryString, droppedKeys, pageNumber, type RawParam } from '@/lib/admin-params';

const PATH = '/admin/activity';

/** Pattern A's date range, worded as the window it is. */
const RANGE_LABELS: Record<AdminActivityRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

/**
 * The console's own record — #434.
 *
 * Every mutation an admin makes writes an `admin_actions` row, and this is
 * where those are read. It is the answer to two questions and it is built
 * around both: "what has this admin been doing" (`?actor=`) and "what did
 * the console do to this account" (`?subject=`). Without the second it would be
 * a firehose rather than a record.
 *
 * No actions on any row. The table is append-only in the database, so a control
 * here would offer something Postgres refuses.
 */
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: RawParam;
    actor?: RawParam;
    subject?: RawParam;
    subjectType?: RawParam;
    range?: RawParam;
    q?: RawParam;
    page?: RawParam;
  }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  /*
   * Parsed before anything formats or queries with it —
   * `.claude/rules/web-route-boundaries.md`. `?actor=nonsense` would otherwise
   * reach an API that validates a uuid and answers 400, which renders as the
   * 500 page for a URL anyone can paste into a support thread.
   */
  const params = activityParams(raw);
  // A blank search is no search, not an unusable value, so `q` is never reported as ignored.
  const { q, ...narrowing } = params;
  const dropped = droppedKeys(raw, narrowing);
  const [activity, { actors }] = await Promise.all([
    getAdminActivity(adminQueryString({ ...params, page: pageNumber(raw.page) })),
    getAdminActivityActors(),
  ]);
  const filtered = Object.values(params).some((value) => value !== undefined);

  /*
   * The active filters, each paired with the words that drop it (#454).
   *
   * The two identity filters are uuids an admin arrived at by clicking a
   * row, so the widening reads `Any admin` / `Any subject` rather than
   * naming the id: nobody recognises `33333333`, and repeating it on the button
   * would say less than the word does.
   */
  const active: ActiveFilter[] = [
    { key: 'actor', widening: 'Any admin' },
    { key: 'subjectType', widening: 'Any subject type' },
    { key: 'range', widening: 'All time' },
    { key: 'action', widening: 'Any action' },
    { key: 'subject', widening: 'Any subject' },
    { key: 'q', widening: 'Clear the search' },
  ]
    .filter((filter) => params[filter.key as keyof typeof params] !== undefined)
    .map((filter) => ({ ...filter, carried: { ...params, [filter.key]: undefined } }));

  /*
   * The heading recites what is narrowing the view, in the admin's words.
   * `ACTION_LABELS` is the sentence the filter bar and the row already print,
   * so the state names the filter the way it was set rather than by its
   * parameter name.
   */
  const filteredHeadline = q
    ? `No console activity matches "${q}"${Object.values(narrowing).some(Boolean) ? ' and these filters' : ''}`
    : params.action
      ? `No "${ACTION_LABELS[params.action]}" actions match the rest of these filters`
      : 'No console activity matches these filters';

  return (
    <AdminSurface
      heading="Activity"
      counts={[`${activity.total} ${activity.total === 1 ? 'action' : 'actions'} recorded`]}
      dropped={dropped}
      filters={
        <FilterBar
          action={PATH}
          params={params}
          searchPlaceholder="Search admin or subject id…"
          searchValue={q}
          trailing={<ExportCsvLink href={`${PATH}/export${adminQueryString(params)}`} />}
        >
          {/*
            Pattern A's three facets — `Actor ▾`, `Subject type ▾`, date range —
            in the order it names them (VEN-388), then `Action`, which predates
            the pattern and narrows the firehose for nothing.

            `Actor` lists only the admins the log names, so every choice
            narrows to something; a row's own actor cell still sets the same
            parameter.
          */}
          <FilterSelect
            action={PATH}
            name="actor"
            label="Actor"
            value={params.actor ?? ''}
            options={actors.map((actor) => ({ value: actor.id, label: actor.name }))}
          />
          <FilterSelect
            action={PATH}
            name="subjectType"
            label="Subject type"
            value={params.subjectType ?? ''}
            options={ADMIN_ACTION_SUBJECTS.map((subjectType) => ({
              value: subjectType,
              label: SUBJECT_LABELS[subjectType],
            }))}
          />
          <FilterSelect
            action={PATH}
            name="range"
            label="Date range"
            value={params.range ?? ''}
            options={ADMIN_ACTIVITY_RANGES.map((range) => ({
              value: range,
              label: RANGE_LABELS[range],
            }))}
          />
          <FilterSelect
            action={PATH}
            name="action"
            label="Action"
            value={params.action ?? ''}
            options={ADMIN_ACTIONS.map((action) => ({
              value: action,
              label: ACTION_LABELS[action],
            }))}
          />
          {/*
            The subject id has no dropdown and should not: it is a uuid, and a
            list of every record the console ever touched is not a control. It
            arrives from a row's own cell — see `ActivityTable` — and this is
            how it is let go of again.

            `Link`, not a raw `<a>`: an anchor here would reload the whole admin
            shell to drop one query parameter.
          */}
          {params.subject ? (
            <Link
              href={`${PATH}${adminQueryString({ ...params, subject: undefined })}`}
              className="rounded-md border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-stone-900 hover:bg-stone-150"
            >
              Clear subject filter
            </Link>
          ) : null}
        </FilterBar>
      }
      pager={{
        path: PATH,
        params,
        page: activity.page,
        pageSize: activity.pageSize,
        total: activity.total,
      }}
    >
      <ActivityTable
        rows={activity.items}
        path={PATH}
        filtered={filtered}
        pastEnd={
          activity.items.length === 0 && activity.total > 0 ? (
            <OutOfRange
              path={PATH}
              params={params}
              page={activity.page}
              pageSize={activity.pageSize}
              total={activity.total}
            />
          ) : undefined
        }
        /*
         * The counted way out, built here rather than inside the table: the
         * words on each button are this screen's copy, and the table renders
         * three surfaces' worth of rows with no business knowing any of them.
         */
        filteredEmpty={
          <FilteredEmpty
            headline={filteredHeadline}
            path={PATH}
            filters={active}
            widenings={activity.widenings}
          />
        }
      />
    </AdminSurface>
  );
}
