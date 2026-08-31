import Link from 'next/link';
import { TAG_SUGGESTION_STATUSES } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { Pager } from '@/components/admin/pager';
import { TagQueue } from '@/components/admin/tag-queue';
import { TagTable } from '@/components/admin/tag-table';
import { getAdminTagSuggestions, getAdminTags } from '@/lib/admin-data';
import {
  adminQueryString,
  droppedKeys,
  oneOf,
  pageNumber,
  type RawParam,
} from '@/lib/admin-params';
import { cn } from '@/lib/utils';

const PATH = '/admin/tags';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * Categories &amp; tags — the moderation queue above the vocabulary it feeds.
 *
 * Two things on one screen because they are one job: an operator approving a
 * suggestion needs to see whether something close to it already exists, and a
 * separate route would make them hold that in their head.
 */
export default async function AdminTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: RawParam; page?: RawParam }>;
}): Promise<React.ReactElement> {
  const raw = await searchParams;
  // `pending` is the queue's whole purpose, so it is the default rather than "all".
  const parsed = oneOf(raw.status, TAG_SUGGESTION_STATUSES);
  const status = parsed ?? 'pending';
  // Every other console screen says when it ignored something in the address;
  // this one silently fell back to `pending`, which reads as the queue's state.
  const dropped = droppedKeys(raw, { status: parsed });
  const [suggestions, tags] = await Promise.all([
    getAdminTagSuggestions(adminQueryString({ status, page: pageNumber(raw.page) })),
    getAdminTags(),
  ]);

  return (
    <AdminSurface
      heading="Categories & tags"
      counts={[
        `${suggestions.total} ${STATUS_LABELS[status]?.toLowerCase() ?? status}`,
        `${tags.items.length} tags in the vocabulary`,
      ]}
      dropped={dropped}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {TAG_SUGGESTION_STATUSES.map((value) => (
            <Link
              key={value}
              href={`${PATH}${adminQueryString({ status: value })}`}
              aria-pressed={status === value}
              className={cn(
                'rounded-md px-3.5 py-2 text-sm font-semibold',
                status === value
                  ? 'bg-clay-400 text-stone-0'
                  : 'border border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150',
              )}
            >
              {STATUS_LABELS[value] ?? value}
            </Link>
          ))}
        </div>
      }
    >
      <div className="h-full min-h-0 overflow-y-auto pb-2">
        <TagQueue
          suggestions={suggestions.items}
          tags={tags.items}
          showActions={status === 'pending'}
        />
        <Pager
          path={PATH}
          params={{ status }}
          page={suggestions.page}
          pageSize={suggestions.pageSize}
          total={suggestions.total}
        />

        <h2 className="mt-6 mb-2.5 font-display text-[21px] text-stone-900">The vocabulary</h2>
        <TagTable tags={tags.items} />
      </div>
    </AdminSurface>
  );
}
