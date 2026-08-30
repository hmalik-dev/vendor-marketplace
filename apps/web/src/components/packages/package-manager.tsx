'use client';

import { formatPrice } from '@vendor-marketplace/shared';
import { ArrowDown, ArrowUp, GripVertical, Package, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { userFacingError } from '@/lib/user-facing-error';
import { moveItem } from '@/lib/reorder';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireServicePackageListSchema, type WireServicePackage } from '@/lib/wire-schemas';
import { PackageForm, PRICE_TYPE_LABELS } from '@/components/packages/package-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch, SWITCH_TOUCH_TARGET } from '@/components/ui/switch';

export interface PackageManagerProps {
  initialPackages: readonly WireServicePackage[];
  /** Whether the profile is currently listed on the marketplace. */
  isPublished: boolean;
}

/** `null` = nothing selected, `NEW_PACKAGE` = drafting one that does not exist yet. */
const NEW_PACKAGE = 'new';

type Selection = string | typeof NEW_PACKAGE | null;

function priceLabel(servicePackage: WireServicePackage): string {
  const price = formatPrice(servicePackage.priceCents);

  switch (servicePackage.priceType) {
    case 'starting_at':
      return `From ${price}`;
    case 'hourly':
      return `${price} / hour`;
    default:
      return price;
  }
}

/**
 * Master–detail package management: the list on the left, the editor for the
 * selected package beside it. Below `xl` the two share the screen one at a
 * time, so the editor gets full width rather than a 320px column.
 */
export function PackageManager({
  initialPackages,
  isPublished,
}: PackageManagerProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();
  const [packages, setPackages] = useState<readonly WireServicePackage[]>(initialPackages);
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingDeactivation, setPendingDeactivation] = useState<WireServicePackage | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const activeCount = packages.filter((row) => row.isActive).length;
  const selected =
    selection === null || selection === NEW_PACKAGE
      ? null
      : (packages.find((row) => row.id === selection) ?? null);

  const handleSaved = (saved: WireServicePackage): void => {
    setPackages((previous) =>
      previous.some((row) => row.id === saved.id)
        ? previous.map((row) => (row.id === saved.id ? saved : row))
        : [...previous, saved],
    );
    setSelection(saved.id);
    // The publish checklist and dashboard read the package count server-side.
    router.refresh();
  };

  const applyActive = async (target: WireServicePackage, isActive: boolean): Promise<void> => {
    setIsBusy(true);
    try {
      const saved = await request(`/vendor/packages/${target.id}`, {
        method: 'PUT',
        body: { isActive },
        schema: wireServicePackageListSchema.element,
      });

      setPackages((previous) => previous.map((row) => (row.id === saved.id ? saved : row)));
      toast.success(isActive ? 'Package is bookable again.' : 'Package hidden from customers.');
      router.refresh();
    } catch (error) {
      toast.error(userFacingError(error, 'Could not change that package.'));
    } finally {
      setIsBusy(false);
      setPendingDeactivation(null);
    }
  };

  const toggleActive = (target: WireServicePackage, next: boolean): void => {
    // Turning off the last bookable package unpublishes the profile, so the
    // vendor is told before it happens rather than discovering it afterwards.
    if (!next && target.isActive && activeCount === 1 && isPublished) {
      setPendingDeactivation(target);
      return;
    }

    void applyActive(target, next);
  };

  const persistOrder = async (next: readonly WireServicePackage[]): Promise<void> => {
    const previous = packages;
    setPackages(next);
    setIsBusy(true);

    try {
      const saved = await request('/vendor/packages/reorder', {
        method: 'PUT',
        body: { packageIds: next.map((row) => row.id) },
        schema: wireServicePackageListSchema,
      });
      setPackages(saved);
    } catch (error) {
      // Put the list back where it was: the server rejected the new order.
      setPackages(previous);
      toast.error(userFacingError(error, 'Could not save the new order.'));
    } finally {
      setIsBusy(false);
    }
  };

  const move = (from: number, to: number): void => {
    const next = moveItem(packages, from, to);
    if (next.length === packages.length && next[from]?.id !== packages[from]?.id) {
      void persistOrder(next);
    }
  };

  return (
    <>
      <div className="grid min-h-0 gap-4 xl:h-full xl:grid-cols-[var(--rail-booking)_1fr] xl:gap-6">
        {/* The list keeps its own scroll so the editor beside it stays put. */}
        <div
          className={cn(
            'min-h-0 flex-col rounded-lg border border-stone-300 bg-card shadow-sm xl:flex xl:overflow-hidden',
            selection !== null ? 'hidden xl:flex' : 'flex',
          )}
        >
          <ul className="min-h-0 flex-1 divide-y divide-stone-150 xl:overflow-y-auto">
            {packages.map((servicePackage, index) => {
              const isSelected = selection === servicePackage.id;

              return (
                <li
                  key={servicePackage.id}
                  draggable={!isBusy}
                  onDragStart={() => setDraggingId(servicePackage.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = packages.findIndex((row) => row.id === draggingId);
                    setDraggingId(null);
                    if (from !== -1) {
                      move(from, index);
                    }
                  }}
                  className={cn(
                    'flex items-start gap-2 p-3 transition-colors duration-(--duration-fast)',
                    isSelected ? 'bg-clay-100' : 'hover:bg-stone-50',
                    draggingId === servicePackage.id && 'opacity-50',
                  )}
                >
                  <GripVertical
                    aria-hidden="true"
                    className="mt-2 size-4 shrink-0 cursor-grab text-stone-300"
                  />

                  <button
                    type="button"
                    onClick={() => setSelection(servicePackage.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-stone-800">
                      {servicePackage.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-stone-600">
                      {priceLabel(servicePackage)}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-600">
                      {PRICE_TYPE_LABELS[servicePackage.priceType]}
                      {servicePackage.isActive ? '' : ' · Hidden from customers'}
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Switch
                      className={SWITCH_TOUCH_TARGET}
                      checked={servicePackage.isActive}
                      disabled={isBusy}
                      aria-label={`${servicePackage.name} is bookable`}
                      onCheckedChange={(next) => toggleActive(servicePackage, next)}
                    />
                    <div className="flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 lg:size-7"
                        aria-label={`Move ${servicePackage.name} up`}
                        disabled={isBusy || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 lg:size-7"
                        aria-label={`Move ${servicePackage.name} down`}
                        disabled={isBusy || index === packages.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="shrink-0 p-3">
            <button
              type="button"
              onClick={() => setSelection(NEW_PACKAGE)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-200 px-4 py-4 text-sm font-medium text-stone-600 transition-colors duration-(--duration-fast) hover:border-clay-400 hover:bg-clay-100 hover:text-clay-600"
            >
              <Plus aria-hidden="true" className="size-4" />
              Add a package
            </button>
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 rounded-lg border border-stone-300 bg-card shadow-sm xl:overflow-hidden',
            selection === null ? 'hidden xl:block' : 'block',
          )}
        >
          {selection === null ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Package aria-hidden="true" className="size-8 text-stone-300" />
              <p className="font-display text-lg font-semibold text-stone-800">
                {packages.length === 0 ? 'No packages yet' : 'Pick a package to edit'}
              </p>
              <p className="max-w-sm text-sm leading-prose text-stone-600">
                {packages.length === 0
                  ? 'A package is what a customer books. You need at least one bookable package before your profile can go live.'
                  : 'Choose one from the list, or add another.'}
              </p>
            </div>
          ) : (
            <PackageForm
              // Remounting on selection change resets the editor's own state,
              // so an abandoned draft never leaks into the next package.
              key={selection}
              servicePackage={selected}
              onSaved={handleSaved}
              onCancel={() => setSelection(null)}
            />
          )}
        </div>
      </div>

      <Dialog
        open={pendingDeactivation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeactivation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide your last bookable package?</DialogTitle>
            <DialogDescription>
              Your profile will come off the marketplace until you have at least one bookable
              package again. Nothing else about it changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDeactivation(null)}
              disabled={isBusy}
            >
              Keep it bookable
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy}
              onClick={() => {
                if (pendingDeactivation) {
                  void applyActive(pendingDeactivation, false);
                }
              }}
            >
              Hide it anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
