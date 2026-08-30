import { fieldErrorDetailsSchema } from '@vendor-marketplace/shared';
import { ApiClientError } from '@/lib/api-client';
import type { FieldIssue } from '@/lib/use-submit-validation';

/**
 * One control on the storefront editor, in the three vocabularies that have to
 * agree about it: what the API calls it, what the DOM calls it, and what the
 * vendor sees above it.
 *
 * They genuinely differ — the category picker's control is `categories` while
 * its payload key is `categoryIds`, and the radius is chosen in miles and sent
 * in kilometres — so the mapping has to be written down once rather than
 * guessed at by three callers.
 */
interface FieldTarget {
  /** The key the API names in `details.field`, and the head of a Zod issue path. */
  readonly payloadKey: string;
  /** The control's `id`, so the counted summary can link straight to it. */
  readonly id: string;
  /** The `FormState` key the control writes, so editing it clears the message. */
  readonly stateKey: string;
  /** The control's on-screen label; the summary reads as a list of these. */
  readonly label: string;
}

/**
 * Screen order, top to bottom, which is the order the summary lists and the
 * order a vendor works down the form. Zod reports in schema order and the API
 * reports one field at a time, so neither can be trusted to produce it.
 */
const PROFILE_FIELDS: readonly FieldTarget[] = [
  {
    payloadKey: 'profileImageUrl',
    id: 'profileImage',
    stateKey: 'profileImageUrl',
    label: 'Profile photo',
  },
  {
    payloadKey: 'businessName',
    id: 'businessName',
    stateKey: 'businessName',
    label: 'Business name',
  },
  { payloadKey: 'slug', id: 'slug', stateKey: 'slug', label: 'Profile link' },
  { payloadKey: 'tagline', id: 'tagline', stateKey: 'tagline', label: 'Your line' },
  {
    payloadKey: 'yearsInBusiness',
    id: 'yearsInBusiness',
    stateKey: 'yearsInBusiness',
    label: 'Years in business',
  },
  { payloadKey: 'bio', id: 'bio', stateKey: 'bio', label: 'About your business' },
  { payloadKey: 'categoryIds', id: 'categories', stateKey: 'categoryIds', label: 'Categories' },
  { payloadKey: 'address', id: 'address', stateKey: 'address', label: 'Address' },
  { payloadKey: 'city', id: 'city', stateKey: 'city', label: 'City' },
  { payloadKey: 'state', id: 'state', stateKey: 'state', label: 'State' },
  {
    payloadKey: 'serviceRadiusKm',
    id: 'serviceRadius',
    stateKey: 'serviceRadiusMiles',
    label: 'Service radius',
  },
  {
    payloadKey: 'responseTimeHours',
    id: 'responseTime',
    stateKey: 'responseTimeHours',
    label: 'Typical response time',
  },
  { payloadKey: 'tagIds', id: 'tags', stateKey: 'tagIds', label: 'Tags' },
];

/**
 * Everything wrong with one save attempt: what belongs on a control, and what
 * has to be said at the form level because no control owns it.
 *
 * `formMessage` is the half that keeps #222 from recurring. A refusal the
 * client cannot place is still a refusal, and the failure being fixed here is
 * precisely one that was computed and then dropped.
 */
export interface ProfileSaveProblem {
  readonly fields: readonly FieldIssue[];
  readonly formMessage: string | null;
}

export const NO_PROBLEM: ProfileSaveProblem = { fields: [], formMessage: null };

/** Structurally what a Zod issue is, without pinning this to a Zod version. */
interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

function targetForPayloadKey(payloadKey: string): FieldTarget | undefined {
  return PROFILE_FIELDS.find((field) => field.payloadKey === payloadKey);
}

/** The control a `FormState` key writes, or `null` when no control owns it. */
export function controlIdForStateKey(stateKey: string): string | null {
  return PROFILE_FIELDS.find((field) => field.stateKey === stateKey)?.id ?? null;
}

/**
 * Sorts issues into screen order and separates the placeable from the rest.
 *
 * Two messages on one control would stack, so the first wins: they describe the
 * same value, and the vendor only has one thing to change.
 */
function collect(
  found: ReadonlyArray<{ readonly payloadKey: string; readonly message: string }>,
): ProfileSaveProblem {
  const fields: FieldIssue[] = [];
  const unplaced: string[] = [];

  for (const { payloadKey, message } of found) {
    const target = targetForPayloadKey(payloadKey);

    if (!target) {
      unplaced.push(message);
      continue;
    }

    if (!fields.some((issue) => issue.field === target.id)) {
      fields.push({ field: target.id, label: target.label, message, severity: 'blocker' });
    }
  }

  return { fields: inScreenOrder(fields), formMessage: unplaced[0] ?? null };
}

/** Screen order, so the summary reads the way the vendor scrolls. */
function inScreenOrder(fields: readonly FieldIssue[]): FieldIssue[] {
  return [...fields].sort(
    (left, right) =>
      PROFILE_FIELDS.findIndex((field) => field.id === left.field) -
      PROFILE_FIELDS.findIndex((field) => field.id === right.field),
  );
}

/**
 * Both halves of one save attempt as a single list.
 *
 * The client's issue wins a tie: it was computed from what is on screen now,
 * while the server's describes the values as they were sent. Two messages on
 * one control would stack, and the vendor still only has one thing to change.
 */
export function mergeProblems(
  client: ProfileSaveProblem,
  server: ProfileSaveProblem,
): ProfileSaveProblem {
  const fields = [...client.fields];

  for (const issue of server.fields) {
    if (!fields.some((existing) => existing.field === issue.field)) {
      fields.push(issue);
    }
  }

  return {
    fields: inScreenOrder(fields),
    formMessage: server.formMessage ?? client.formMessage,
  };
}

/** What the payload's own schema rejected, before anything is sent. */
export function problemFromValidationIssues(
  issues: readonly ValidationIssue[],
): ProfileSaveProblem {
  if (issues.length === 0) {
    return NO_PROBLEM;
  }

  return collect(
    issues.map((issue) => ({ payloadKey: String(issue.path[0] ?? ''), message: issue.message })),
  );
}

/**
 * What the API refused, or what stopped the request from getting there.
 *
 * A non-`ApiClientError` means the request never completed, so it says so
 * rather than blaming the profile: the vendor's next move is to save again, not
 * to change a field.
 */
export function problemFromSaveError(error: unknown): ProfileSaveProblem {
  if (!(error instanceof ApiClientError)) {
    return {
      fields: [],
      formMessage: 'Your profile did not reach us. Check your connection and save again.',
    };
  }

  const details = fieldErrorDetailsSchema.safeParse(error.details);

  return details.success
    ? collect([{ payloadKey: details.data.field, message: error.message }])
    : { fields: [], formMessage: error.message };
}
