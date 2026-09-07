import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Vendor onboarding, in the order frame `32` fixes it — and the order is a
 * decision rather than a layout.
 *
 * **The agreement precedes Stripe Connect.** The commission and the payout
 * timing are agreed *before* a payout rail exists to implement them: accepting
 * afterwards would mean a vendor hands over bank details before knowing what
 * the platform keeps, and a refusal at step 4 would leave a verified Connect
 * account attached to a listing nobody can pay.
 *
 * Step 1 is Clerk's, and it is drawn here even though this component never
 * renders on it — a rail that starts at 2 tells a vendor they are further from
 * the start than they are.
 */
export const ONBOARDING_STEPS = [
  'Create account',
  'Profile basics',
  'Vendor agreement',
  'Payouts · Stripe',
  'Publish',
] as const;

export interface OnboardingStepsProps {
  /** 1-based, so it reads as the header's `Step 3 of 5` does. */
  current: number;
}

export function OnboardingSteps({ current }: OnboardingStepsProps): React.ReactElement {
  return (
    <nav aria-label="Vendor onboarding" className="mb-7">
      <p className="mb-3 text-label font-semibold tracking-label text-stone-600 uppercase">
        Step {current} of {ONBOARDING_STEPS.length}
      </p>
      <ol className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        {ONBOARDING_STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;

          return (
            <li key={label} className="flex items-center gap-3.5">
              <span className="flex items-center gap-2.25">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6.5 flex-none items-center justify-center rounded-full text-[11px] font-semibold',
                    done && 'bg-sage-400 text-stone-0',
                    active && 'bg-clay-400 text-stone-0',
                    !done && !active && 'border border-stone-300 text-stone-500',
                  )}
                >
                  {done ? <Check aria-hidden="true" className="size-3.5" /> : step}
                </span>
                <span
                  className={cn(
                    'text-action',
                    active ? 'font-semibold text-clay-500' : 'text-stone-500',
                  )}
                >
                  {label}
                </span>
              </span>
              {/* The 26px hairline connector, dropped after the last step. */}
              {step < ONBOARDING_STEPS.length ? (
                <span aria-hidden="true" className="h-px w-6.5 bg-stone-300" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
