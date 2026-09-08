import Link from 'next/link';
import { ADMIN_ACTIONS } from '@vendor-marketplace/shared';
import { ACTION_LABELS, ActivityTable } from '@/components/admin/activity-table';
import { AdminSurface } from '@/components/admin/admin-surface';
import { FilterBar, FilterSelect } from '@/components/admin/filter-bar';
import { FilteredEmpty, type ActiveFilter } from '@/components/admin/filtered-empty';
import { getAdminActivity } from '@/lib/admin-data';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  uuidParam,
  type RawParam,
} from '@/lib/admin-params';

const PATH = '/admin/activity';

/**
 * The console's own record — #434.
 *
 * Every mutation an operator makes writes an `admin_actions` row, and this is
 * where those are read. It is the answer to two questions and it is built
 * around both: "what has this operator been doing" (`?actor=`) and "what did
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
  const params = {
    action: oneOf(raw.action, ADMIN_ACTIONS),
    actor: uuidParam(raw.actor),
    subject: uuidParam(raw.subject),
  };
  const dropped = droppedKeys(raw, params);
  const activity = await getAdminActivity(
    adminQueryString({ ...params, page: pageNumber(raw.page) }),
  );
  const filtered = Boolean(params.action ?? params.actor ?? params.subject);
  /*
   * The two identity filters, as things to let go of.
   *
   * One entry each rather than two hand-written chips: they differ only in
   * which parameter they drop, and the duplicated class string was the half
   * that would have drifted. Each keeps every filter except its own.
   */
  const applied = [
    { key: 'actor', label: 'Clear operator filter', href: { ...params, actor: undefined } },
    { key: 'subject', label: 'Clear subject filter', href: { ...params, subject: undefined } },
  ].filter((chip) => params[chip.key as 'actor' | 'subject'] !== undefined);

  /*
   * The active filters, each paired with the words that drop it (#454).
   *
   * The two identity filters are uuids an operator arrived at by clicking a
   * row, so the widening reads `Any operator` / `Any subject` rather than
   * naming the id: nobody recognises `33333333`, and repeating it on the button
   * would say less than the word does.
   */
  const active: ActiveFilter[] = [
    { key: 'action', widening: 'Any action' },
    { key: 'actor', widening: 'Any operator' },
    { key: 'subject', widening: 'Any subject' },
  ]
    .filter((filter) => params[filter.key as keyof typeof params] !== undefined)
    .map((filter) => ({ ...filter, carried: { ...params, [filter.key]: undefined } }));

  /*
   * The heading recites what is narrowing the view, in the operator's words.
   * `ACTION_LABELS` is the sentence the filter bar and the row already print,
   * so the state names the filter the way it was set rather than by its
   * parameter name.
   */
  const filteredHeadline = params.action
    ? `No "${ACTION_LABELS[params.action]}" actions match the rest of these filters`
    : 'No console activity matches these filters';

  return (
    <AdminSurface
      heading="Activity"
      counts={[`${activity.total} ${activity.total === 1 ? 'action' : 'actions'} recorded`]}
      dropped={dropped}
      filters={
        <FilterBar action={PATH} params={params}>
          <FilterSelect
            action={PATH}
            carried={{ actor: params.actor, subject: params.subject }}
            name="action"
            label="Action"
            value={params.action ?? ''}
            options={ADMIN_ACTIONS.map((action) => ({
              value: action,
              label: ACTION_LABELS[action],
            }))}
          />
          {/*
            The identity filters have no dropdown and should not: they are
            uuids, and a list of every operator and every subject the platform
            holds is not a control. They arrive from a row's own cell — see
            `ActivityTable` — and this is how they are let go of again.

            `Link`, not a raw `<a>`: every other control in the console uses it,
            and an anchor here would reload the whole admin shell to drop one
            query parameter. The treatment is the filter-bar pill
            `/admin/vendors` and `/admin/tags` already draw.
          */}
          {applied.map((chip) => (
            <Link
              key={chip.key}
              href={`${PATH}${adminQueryString(chip.href)}`}
              className="rounded-md border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-150"
            >
              {chip.label}
            </Link>
          ))}
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
