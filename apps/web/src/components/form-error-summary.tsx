import { describeBlockerCount, type FieldIssue } from '@/lib/use-submit-validation';

/**
 * Frame `22`'s red card and the pieces that hang off it, in one place.
 *
 * These were written three times — once in the storefront editor, once in the
 * booking request screen, and not at all in the package editor — and #388 is
 * what that cost. The booking screen's copy was missing `role="alert"`, so a
 * refusal it rendered perfectly well announced nothing; the package editor had
 * no card at all and used a toast. A shared card cannot lose its role in one
 * of three places.
 */

/**
 * The card itself. Used for both things that can go wrong at form level: the
 * counted summary, and a refusal that belongs to no single control.
 *
 * `role="alert"` is the part #222 was missing on the editor and #388 found
 * still missing on the booking request — a save that failed announced nothing,
 * so the button read as dead.
 */
export function FormErrorCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      role="alert"
      className="mb-5 flex max-w-[640px] items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3.25"
    >
      <span aria-hidden="true" className="mt-0.25 size-4.5 shrink-0 rounded-full bg-error-500" />
      {children}
    </div>
  );
}

/**
 * The counted summary — frame `22`'s headline, which counts rather than lists,
 * with the labels underneath as links to the controls they name.
 *
 * Renders nothing when there is nothing to count, so a caller can hand it the
 * blocker list unconditionally instead of repeating the guard.
 */
export function FormErrorSummary({
  blockers,
}: {
  blockers: readonly FieldIssue[];
}): React.ReactElement | null {
  if (blockers.length === 0) {
    return null;
  }

  return (
    <FormErrorCard>
      <div>
        <p className="mb-0.75 text-base font-semibold text-stone-900">
          {describeBlockerCount(blockers.length)}
        </p>
        <p className="text-sm text-stone-700">
          {blockers.map((issue, index) => (
            <span key={issue.field}>
              {index > 0 ? ' · ' : null}
              <a
                href={`#${issue.field}`}
                className="font-semibold text-error-500 underline underline-offset-2"
              >
                {issue.label}
              </a>
            </span>
          ))}
        </p>
      </div>
    </FormErrorCard>
  );
}

/** The red line under a control. `40-states.md`: it says how to fix it. */
export function FieldMessage({ issue }: { issue: FieldIssue | null }): React.ReactElement | null {
  if (issue === null) {
    return null;
  }

  return (
    <p id={`${issue.field}-error`} className="mt-1.5 text-helper text-error-500">
      {issue.message}
    </p>
  );
}

/**
 * The attributes that tie a real control to its red message.
 *
 * Returned as a pair with `FieldMessage` rather than written out per field,
 * because the failure mode is an `aria-describedby` pointing at an id that is
 * not rendered — which reads as fixed and announces nothing.
 */
export function errorProps(
  issue: FieldIssue | null,
  ...alsoDescribedBy: readonly string[]
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  const described = [...(issue ? [`${issue.field}-error`] : []), ...alsoDescribedBy];

  return {
    ...(issue ? { 'aria-invalid': true as const } : {}),
    ...(described.length > 0 ? { 'aria-describedby': described.join(' ') } : {}),
  };
}

/**
 * Ties a control's message to it, for anything that is not itself a form
 * control — a picker or a photo, which are groups of buttons.
 *
 * `aria-invalid` is not a global attribute: on a generic element it is inert,
 * so writing it there would look like accessible feedback while announcing
 * nothing. The group is named and described instead, and the summary card
 * carries the announcement.
 */
export function describedByProps(issue: FieldIssue | null): { 'aria-describedby'?: string } {
  return issue ? { 'aria-describedby': `${issue.field}-error` } : {};
}
