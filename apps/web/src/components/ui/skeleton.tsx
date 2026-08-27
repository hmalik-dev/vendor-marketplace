import { cn } from '@/lib/utils';

/**
 * Content loading is skeletons, always — one variant per content type,
 * mirroring the real dimensions so the layout doesn't jump when data lands.
 * Never a spinner and a skeleton on the same screen.
 *
 * See design/design-plan/03-components.md.
 */
export function Skeleton({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('skeleton-surface block rounded-md', className)}
    />
  );
}

/** A vendor card's shape: 4:3 cover, name, meta row, chips, price row. */
export function VendorCardSkeleton(): React.ReactElement {
  return (
    <div
      data-slot="skeleton-vendor-card"
      className="overflow-hidden rounded-2xl bg-stone-0 shadow-sm"
    >
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

/** A 56px app row. */
export function RowSkeleton(): React.ReactElement {
  return (
    <div data-slot="skeleton-row" className="flex h-(--row-height) items-center gap-3 px-4">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-3.5 flex-1" />
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}

/**
 * The element spinner: a 16px clay ring with a transparent quarter. Used inside
 * a button while its own action runs, never alongside a skeleton.
 */
export function Spinner({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        'inline-block size-4 shrink-0 rounded-full border-2 border-clay-400 border-t-transparent motion-safe:animate-spin',
        className,
      )}
    />
  );
}

/**
 * The page-level state: the wordmark pulsing. First load and auth redirects
 * only — anything else gets skeletons.
 */
export function PageLoading({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] items-center justify-center font-display text-display-md text-clay-500 motion-safe:animate-wordmark-pulse"
    >
      {children}
    </div>
  );
}
