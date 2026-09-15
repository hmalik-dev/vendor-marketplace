'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  adminCategoryListSchema,
  adminCategoryRowSchema,
  type AdminCategoryRow,
} from '@vendor-marketplace/shared';
import { expirePublicCategories } from '@/app/admin/tags/actions';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { DataTable } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';

/**
 * The taxonomy in the tag table's shape: the same `DataTable`, state pill and
 * soft-remove dialog, plus the order the public list follows.
 *
 * Names and slugs are read-only here — they belong to the seeds. An operator
 * decides whether a category is offered and where it sits, and every write
 * expires the shared taxonomy cache so the landing pills and the search rail
 * change on the next request.
 */
export function CategoryTable({
  categories,
}: {
  categories: readonly AdminCategoryRow[];
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function after(): Promise<void> {
    await expirePublicCategories();
    router.refresh();
  }

  /** A row write outside the dialog: one at a time, and a failure says so above the table. */
  async function run(write: () => Promise<void>, fallback: string): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await write();
    } catch (failure) {
      setError(userFacingError(failure, fallback));
    } finally {
      setPending(false);
    }
  }

  function move(index: number, offset: -1 | 1): Promise<void> {
    const ids = categories.map((category) => category.id);
    const target = index + offset;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    return run(async () => {
      await call('/admin/categories/order', {
        method: 'PUT',
        body: { categoryIds: ids },
        schema: adminCategoryListSchema,
      });
      await after();
    }, 'That order did not save.');
  }

  /** Throws on failure, so the deactivation dialog can keep itself open and say why. */
  async function setActive(category: AdminCategoryRow, isActive: boolean): Promise<void> {
    await call(`/admin/categories/${category.id}`, {
      method: 'PUT',
      body: { isActive },
      schema: adminCategoryRowSchema,
    });
    await after();
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-helper text-error-500">
          {error}
        </p>
      ) : null}
      <DataTable
        rows={categories}
        rowKey={(category) => category.id}
        empty={null}
        columns={[
          {
            key: 'position',
            width: '.5fr',
            header: 'Order',
            cell: (category) => categories.indexOf(category) + 1,
          },
          {
            key: 'name',
            width: '1.6fr',
            header: 'Name',
            className: 'font-semibold text-stone-900',
            cell: (category) => category.name,
          },
          {
            key: 'slug',
            width: '1.4fr',
            header: 'Slug',
            className: 'font-mono',
            cell: (category) => category.slug,
          },
          {
            key: 'vendors',
            width: '.8fr',
            header: 'Vendors',
            cell: (category) => category.vendorCount,
          },
          {
            key: 'state',
            width: '.8fr',
            header: 'State',
            cell: (category) =>
              category.isActive ? (
                <StatusPill tone="confirmed">Active</StatusPill>
              ) : (
                <StatusPill tone="inert">Hidden</StatusPill>
              ),
          },
          {
            key: 'actions',
            width: '260px',
            header: '',
            className: 'flex justify-end gap-1.5',
            cell: (category) => {
              const index = categories.indexOf(category);

              return (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending || index === 0}
                    aria-label={`Move ${category.name} up`}
                    onClick={() => void move(index, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending || index === categories.length - 1}
                    aria-label={`Move ${category.name} down`}
                    onClick={() => void move(index, 1)}
                  >
                    Down
                  </Button>
                  {category.isActive ? (
                    <Deactivate category={category} onConfirm={() => setActive(category, false)} />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () => setActive(category, true),
                          'That category was not reactivated.',
                        )
                      }
                    >
                      Reactivate
                    </Button>
                  )}
                </>
              );
            },
          },
        ]}
      />
    </div>
  );
}

function Deactivate({
  category,
  onConfirm,
}: {
  category: AdminCategoryRow;
  onConfirm: () => Promise<void>;
}): React.ReactElement {
  return (
    <ConfirmAction
      trigger={
        <Button type="button" size="sm" variant="secondary">
          Deactivate
        </Button>
      }
      title={`Hide “${category.name}”?`}
      description={
        <>
          This category lists{' '}
          <strong className="font-semibold">
            {category.vendorCount} {category.vendorCount === 1 ? 'vendor' : 'vendors'}
          </strong>
          . Deactivating removes it from the home page, the search filters and the category picker,
          but it is not removed from the profiles that already have it.
        </>
      }
      confirmLabel="Hide category"
      onConfirm={onConfirm}
    />
  );
}
