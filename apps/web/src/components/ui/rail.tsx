import { cn } from '@/lib/utils';

/**
 * A persistent rail beats a modal (design/design-plan/04-laws.md, law 4).
 * Filters, order summaries, booking context and publish checklists live here.
 *
 * A rail never scrolls the page: if its content overflows, the rail scrolls
 * internally.
 */
export interface RailProps {
  children: React.ReactNode;
  className?: string;
}

export function Rail({ children, className }: RailProps): React.ReactElement {
  return (
    <aside
      data-slot="rail"
      className={cn(
        'app-pane flex flex-col gap-5 rounded-xl border border-stone-300 bg-stone-0 p-5',
        className,
      )}
    >
      {children}
    </aside>
  );
}

export interface RailSectionProps {
  /** The 10.5px uppercase label at the top of each block. */
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function RailSection({ label, children, className }: RailSectionProps): React.ReactElement {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">{label}</h2>
      {children}
    </section>
  );
}
