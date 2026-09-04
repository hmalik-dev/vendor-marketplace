import { MAX_GUEST_COUNT } from '@vendor-marketplace/shared';
import type { FieldIssue } from '@/lib/use-submit-validation';

/**
 * One control on the package editor, in the vocabularies that have to agree
 * about it: what the payload calls it, what the DOM calls it, and what the
 * vendor reads above it.
 *
 * The same shape `vendor-profile-issues.ts` uses, kept separate because the
 * control ids here are suffixes of the form's `useId()` prefix — the editor
 * renders one pane per package, so a fixed id would collide.
 */
interface PackageFieldTarget {
  /** The head of a Zod issue path on the create/update payload. */
  readonly payloadKey: string;
  /** Appended to the form's `useId()` prefix to make the control's `id`. */
  readonly idSuffix: string;
  /** The control's on-screen label; the summary reads as a list of these. */
  readonly label: string;
  /**
   * Written copy, for the rules whose Zod message describes a shape rather than
   * a fix — "Too small: expected string to have >=10 characters". `40-states.md`
   * requires every message to say how to fix it, so those are replaced here.
   * Omitted where the schema's own message already does that, which is the case
   * for the price band.
   */
  readonly message?: string;
}

/**
 * Screen order, top to bottom — the order the summary lists and the order the
 * vendor works down the pane. Zod reports in schema order, which is not it.
 */
const PACKAGE_FIELDS: readonly PackageFieldTarget[] = [
  {
    payloadKey: 'name',
    idSuffix: 'name',
    label: 'Package name',
    message: 'Enter a package name — at least 2 characters',
  },
  {
    payloadKey: 'description',
    idSuffix: 'description',
    label: 'What it includes',
    message: 'Describe what the customer gets, in at least 10 characters',
  },
  { payloadKey: 'priceCents', idSuffix: 'price', label: 'Price' },
  { payloadKey: 'priceType', idSuffix: 'priceType', label: 'How it is priced' },
  {
    payloadKey: 'durationHours',
    idSuffix: 'duration',
    label: 'Duration',
    message: 'Enter a duration between 0.5 and 999.9 hours, or leave it blank',
  },
  {
    payloadKey: 'maxGuests',
    idSuffix: 'guests',
    label: 'Maximum guests',
    message: `Enter a whole number of guests between 1 and ${MAX_GUEST_COUNT}, or leave it blank`,
  },
];

/** Structurally what a Zod issue is, without pinning this to a Zod version. */
interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Everything wrong with one save attempt, split by whether a control owns it. */
export interface PackageSaveProblem {
  readonly fields: readonly FieldIssue[];
  /** A refusal no control on this pane can carry, so the card says it instead. */
  readonly formMessage: string | null;
}

export const NO_PACKAGE_PROBLEM: PackageSaveProblem = { fields: [], formMessage: null };

/**
 * Sorts a schema failure onto the controls that caused it.
 *
 * Two messages on one control would stack, so the first wins: they describe the
 * same value and the vendor has one thing to change. Anything the pane does not
 * lay out — `inclusions`, `displayOrder` — has no control to sit on and becomes
 * the form-level message rather than being dropped, which is the #222 failure
 * this shape exists to prevent.
 */
export function packageProblemFrom(
  issues: readonly ValidationIssue[],
  fieldId: string,
): PackageSaveProblem {
  const fields: FieldIssue[] = [];
  const unplaced: string[] = [];

  for (const issue of issues) {
    const payloadKey = String(issue.path[0] ?? '');
    const target = PACKAGE_FIELDS.find((field) => field.payloadKey === payloadKey);

    if (!target) {
      unplaced.push(issue.message);
      continue;
    }

    const field = `${fieldId}-${target.idSuffix}`;

    if (!fields.some((existing) => existing.field === field)) {
      fields.push({
        field,
        label: target.label,
        message: target.message ?? issue.message,
        severity: 'blocker',
      });
    }
  }

  return {
    fields: fields.sort(
      (left, right) =>
        PACKAGE_FIELDS.findIndex((field) => `${fieldId}-${field.idSuffix}` === left.field) -
        PACKAGE_FIELDS.findIndex((field) => `${fieldId}-${field.idSuffix}` === right.field),
    ),
    formMessage: unplaced[0] ?? null,
  };
}
