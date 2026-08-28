import { cn } from '@/lib/utils';

/** The three states across the top of the form column — frame `04`. */
export const REQUEST_STEPS = ['Event details', 'Review & send', 'Vendor confirms'] as const;

export interface RequestStepperProps {
  /** 1-based, matching the numerals the frame draws in the circles. */
  current: 1 | 2 | 3;
}

/**
 * Three 26px circles joined by 44×2px connectors. The current step is a
 * `clay-400` fill; the ones ahead of it are `stone-200` with muted labels.
 *
 * Rendered as an ordered list rather than a row of divs so a screen reader
 * reads "step 2 of 3" from the structure instead of from a label nobody wrote.
 *
 * Below `sm` only the current step keeps its label. All three labels at 390
 * pushed the row past the viewport and put a horizontal scrollbar on the page,
 * which `04-laws.md` rules out; the numerals alone still carry the progress.
 */
export function RequestStepper({ current }: RequestStepperProps): React.ReactElement {
  return (
    <ol aria-label="Booking request progress" className="mb-5.5 flex items-center gap-3">
      {REQUEST_STEPS.map((step, index) => {
        const number = index + 1;
        const isCurrent = number === current;

        return (
          <li key={step} className="flex items-center gap-3">
            {index > 0 ? <span aria-hidden="true" className="h-0.5 w-11 bg-stone-300" /> : null}
            <span
              className="flex items-center gap-2"
              {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6.5 items-center justify-center rounded-full text-xs font-bold',
                  isCurrent ? 'bg-clay-400 text-stone-0' : 'bg-stone-200 text-stone-600',
                )}
              >
                {number}
              </span>
              <span
                className={cn(
                  'text-[13px] whitespace-nowrap',
                  isCurrent
                    ? 'font-semibold text-clay-600'
                    : 'hidden font-medium text-stone-600 sm:inline',
                )}
              >
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
