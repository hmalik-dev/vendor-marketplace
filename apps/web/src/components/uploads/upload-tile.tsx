'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { UploadTask } from '@/lib/uploads';

export interface UploadTileProps {
  task: UploadTask;
  /** Removes a settled tile once its reason has been read. */
  onDismiss: (id: string) => void;
}

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The determinate percentage ring frame `24` draws on an uploading tile.
 * `40-states.md` allows no indeterminate spinner here — a vendor watching
 * twenty photographs needs to know which of them is nearly done.
 */
function ProgressRing({ percent }: { percent: number }): React.ReactElement {
  return (
    <span className="relative flex size-11 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute size-11 -rotate-90" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="2"
          className="stroke-stone-300"
        />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
          className="stroke-clay-400 transition-[stroke-dashoffset] duration-(--duration-base)"
        />
      </svg>
      <span className="text-[11px] font-semibold text-stone-700">{percent}%</span>
    </span>
  );
}

/**
 * One file in the upload queue, in every state it can be in.
 *
 * A failed file keeps its tile rather than disappearing, so the vendor can
 * tell which shot it was — that is the whole reason this is a tile and not a
 * toast. The reason and its matching fix are on the tile itself; the banner
 * above only counts.
 */
export function UploadTile({ task, onDismiss }: UploadTileProps): React.ReactElement {
  const failed = task.status === 'failed';
  const gold = task.failure?.tone === 'gold';

  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-sm',
        failed
          ? gold
            ? 'border-gold-300 bg-gold-50'
            : 'border-error-200 bg-error-50'
          : 'border-stone-300',
      )}
    >
      <div
        className={cn(
          'flex aspect-[4/3] w-full items-center justify-center',
          // A queued tile is a skeleton, never a spinner — `40-states.md`.
          task.status === 'queued' && 'animate-pulse bg-stone-200',
          task.status === 'uploading' && 'bg-stone-100',
          failed && 'bg-stone-150',
        )}
      >
        {task.status === 'uploading' ? <ProgressRing percent={task.progress} /> : null}
      </div>

      {/* The 3px determinate bar along the bottom of the cover, per frame `24`. */}
      <div className="h-[3px] w-full bg-stone-200">
        <div
          className={cn(
            'h-full transition-[width] duration-(--duration-base)',
            failed ? (gold ? 'bg-gold-400' : 'bg-error-500') : 'bg-clay-400',
          )}
          style={{ width: `${failed ? 100 : task.progress}%` }}
        />
      </div>

      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-stone-800" title={task.name}>
            {task.name}
          </p>
          {task.status === 'failed' || task.status === 'done' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={`Dismiss ${task.name}`}
              onClick={() => onDismiss(task.id)}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
        </div>

        {task.failure ? (
          <>
            <p className={cn('text-xs', gold ? 'text-gold-600' : 'text-error-500')}>
              {task.failure.reason}
            </p>
            <p className="text-xs text-stone-600">{task.failure.fix}</p>
          </>
        ) : (
          <p className="text-xs text-stone-600">
            {task.status === 'queued' ? 'Queued' : task.status === 'done' ? 'Saved' : 'Uploading…'}
          </p>
        )}
      </div>
    </li>
  );
}
