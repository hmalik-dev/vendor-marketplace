import { cn } from '@/lib/utils';

/**
 * Stand-in imagery until real photography exists: a hatched swatch with a
 * mono label naming the shot it is waiting for. Never an illustration, never a
 * stock photo — the label is the point, because it reads as deliberately
 * unfinished rather than as a design choice.
 *
 * See design/design-plan/03-components.md.
 */
export interface PlaceholderProps {
  /** Names the shot: "cover 4:3", "photographer / portrait". */
  label: string;
  className?: string;
}

export function Placeholder({ label, className }: PlaceholderProps): React.ReactElement {
  return (
    <div
      role="img"
      aria-label={`Placeholder for ${label}`}
      data-slot="placeholder"
      className={cn('placeholder-hatch flex items-end p-2.5', className)}
    >
      <span aria-hidden="true" className="font-mono text-[9px] text-stone-600">
        {label}
      </span>
    </div>
  );
}
