'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MAX_NAME_LENGTH, type TagCategory } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { TAG_CATEGORY_LABELS } from '@/components/tags/tag-display';
import { useApi } from '@/lib/use-api';
import { REQUEST_DID_NOT_ARRIVE, userFacingError } from '@/lib/user-facing-error';
import { wireAdminTagRowSchema, type WireAdminTagRow } from '@/lib/wire-schemas';

/**
 * The vocabulary, grouped by category and editable in place.
 *
 * Deactivation is a soft remove and the dialog says so with a real count:
 * existing `vendor_tags` rows survive, so a vendor keeps the tag they chose
 * while it stops being offered and stops filtering search.
 */
export function TagTable({ tags }: { tags: readonly WireAdminTagRow[] }): React.ReactElement {
  const byCategory = new Map<TagCategory, WireAdminTagRow[]>();

  for (const tag of tags) {
    const group = byCategory.get(tag.category) ?? [];
    group.push(tag);
    byCategory.set(tag.category, group);
  }

  if (tags.length === 0) {
    return (
      <EmptyState
        panel
        headline="No tags yet"
        description="Seed the reference data, or approve a suggestion from the queue above."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {[...byCategory.entries()].map(([category, group]) => (
        <section key={category}>
          <h3 className="mb-2 text-label font-semibold tracking-label text-stone-600 uppercase">
            {TAG_CATEGORY_LABELS[category]}
          </h3>
          <DataTable
            rows={group}
            rowKey={(tag) => tag.id}
            empty={null}
            columns={[
              {
                key: 'name',
                width: '1.6fr',
                header: 'Name',
                className: 'font-semibold text-stone-900',
                cell: (tag) => <TagName tag={tag} />,
              },
              {
                key: 'slug',
                width: '1.4fr',
                header: 'Slug',
                className: 'font-mono',
                cell: (tag) => tag.slug,
              },
              { key: 'vendors', width: '.8fr', header: 'Vendors', cell: (tag) => tag.vendorCount },
              {
                key: 'state',
                width: '.8fr',
                header: 'State',
                cell: (tag) =>
                  tag.isActive ? (
                    <StatusPill tone="confirmed">Active</StatusPill>
                  ) : (
                    <StatusPill tone="inert">Hidden</StatusPill>
                  ),
              },
              {
                key: 'actions',
                width: '130px',
                header: '',
                className: 'flex justify-end',
                cell: (tag) => <ToggleActive tag={tag} />,
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}

/** Rename in place. The slug follows the name — the API regenerates it. */
function TagName({ tag }: { tag: WireAdminTagRow }): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        /*
          `md:truncate`, not `truncate`. `DataTable`'s card list drops the
          truncation from the cell wrapper below 768 because a card has nothing
          to widen and no pane to scroll — but a `white-space: nowrap` set
          *inside* the cell is out of that wrapper's reach. A tag name may be
          100 characters (`updateTagSchema`), and at 390 a 66-character one
          measured `clientWidth 186 / scrollWidth 425`: 44% of the value shown,
          elided, with no way to read the rest.
        */
        className="text-left hover:underline md:truncate"
      >
        {tag.name}
      </button>
    );
  }

  async function save(): Promise<void> {
    setError(null);

    try {
      await call(`/admin/tags/${tag.id}`, {
        method: 'PUT',
        body: { name },
        schema: wireAdminTagRowSchema,
      });
      setEditing(false);
      router.refresh();
    } catch (failure) {
      setError(userFacingError(failure, 'That rename did not save.'));
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        type="text"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        aria-label={`Rename ${tag.name}`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void save();
          }
          if (event.key === 'Escape') {
            setName(tag.name);
            setEditing(false);
          }
        }}
        className="w-full min-w-0 rounded-md border border-stone-300 bg-stone-0 px-2 py-1 text-base"
      />
      {error ? (
        <span role="alert" className="text-helper text-error-500">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function ToggleActive({ tag }: { tag: WireAdminTagRow }): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [error, setError] = useState<string | null>(null);

  async function setActive(isActive: boolean): Promise<void> {
    await call(`/admin/tags/${tag.id}`, {
      method: 'PUT',
      body: { isActive },
      schema: wireAdminTagRowSchema,
    });
    router.refresh();
  }

  /*
   * Reactivating has no dialog, so nothing else would report a failure — an
   * expired session or a 5xx would be an unhandled rejection and a button that
   * appears to do nothing. Deactivate goes through `ConfirmAction`, which
   * surfaces its own.
   */
  async function reactivate(): Promise<void> {
    setError(null);

    try {
      await setActive(true);
    } catch (failure) {
      setError(userFacingError(failure, REQUEST_DID_NOT_ARRIVE));
    }
  }

  if (!tag.isActive) {
    return (
      <span className="flex flex-col items-end gap-1">
        <Button type="button" size="sm" variant="secondary" onClick={() => void reactivate()}>
          Reactivate
        </Button>
        {error ? (
          <span role="alert" className="text-helper text-error-500">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <ConfirmAction
      trigger={
        <Button type="button" size="sm" variant="secondary">
          Deactivate
        </Button>
      }
      title={`Hide “${tag.name}”?`}
      description={
        <>
          This tag is used by{' '}
          <strong className="font-semibold">
            {tag.vendorCount} {tag.vendorCount === 1 ? 'vendor' : 'vendors'}
          </strong>
          . Hiding it removes it from the tag picker and the search filters. Profiles that already
          have it keep it.
        </>
      }
      confirmLabel="Hide tag"
      onConfirm={() => setActive(false)}
    />
  );
}
