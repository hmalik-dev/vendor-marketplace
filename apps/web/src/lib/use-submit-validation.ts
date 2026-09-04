'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * One thing wrong with the form, named the way the summary names it.
 *
 * `message` says how to fix it — "Needs 10 digits — you're two short", never
 * "Invalid" — which is the rule `40-states.md` states and frame `22` draws.
 */
export interface FieldIssue {
  /** The field's id, so the summary can link straight to it. */
  field: string;
  /** How the field is labelled on screen — the summary reads as a list of labels. */
  label: string;
  message: string;
  /**
   * `blocker` is red and stops the submit. `costly` is gold: the value is
   * legal, but it will probably lose the booking — a date the vendor blocked.
   * Gold never stops anything, which is what makes it different from red.
   */
  severity: 'blocker' | 'costly';
}

export interface SubmitValidation {
  /** True once a submit has been attempted; nothing is shown in red before it. */
  attempted: boolean;
  /** The issue to render under `field`, or `null`. */
  issueFor: (field: string) => FieldIssue | null;
  /** Red issues, in field order — the ones the summary counts. */
  blockers: readonly FieldIssue[];
  /** Gold issues. Always visible, because they are advice rather than errors. */
  costly: readonly FieldIssue[];
  /**
   * Runs `onValid` only when nothing is blocking; otherwise reveals the errors
   * and moves focus to the first blocked control.
   */
  attemptSubmit: (onValid: () => void) => void;
  /** Puts the form back to its pre-submit silence — used when a step changes. */
  reset: () => void;
}

/**
 * The three-tier validation model, in one place so no screen invents a second
 * one: red on the wrong field, gold on the field that is valid but costly, and
 * a counted summary at the submit bar that links to each.
 *
 * `issues` is recomputed by the caller from current values on every render, so
 * a corrected field stops producing an issue and its message disappears on its
 * own — which is exactly the "cleared per-field on correction" rule, with no
 * per-field bookkeeping to get wrong.
 */
export function useSubmitValidation(issues: readonly FieldIssue[]): SubmitValidation {
  const [attempted, setAttempted] = useState(false);

  const blockers = useMemo(() => issues.filter((issue) => issue.severity === 'blocker'), [issues]);
  const costly = useMemo(() => issues.filter((issue) => issue.severity === 'costly'), [issues]);

  const issueFor = useCallback(
    (field: string): FieldIssue | null => {
      const issue = issues.find((candidate) => candidate.field === field) ?? null;

      if (!issue) {
        return null;
      }

      // Gold is advice and shows immediately; red waits for a submit attempt.
      return issue.severity === 'costly' || attempted ? issue : null;
    },
    [issues, attempted],
  );

  const attemptSubmit = useCallback(
    (onValid: () => void) => {
      setAttempted(true);

      if (blockers.length === 0) {
        onValid();
        return;
      }

      /*
       * The browser used to do this, as a side effect of cancelling the submit
       * on an empty `required` input — and cancelling it was the #388 defect,
       * because it also stopped the summary and the field messages from ever
       * rendering. Forms own their validation now, so they owe the focus move
       * too: it is the signal a mouse user notices, and the control it lands on
       * is `aria-describedby` its own message, so the reason is announced on
       * arrival rather than only the label.
       *
       * Deferred a frame because the message it points at is rendered by the
       * commit `setAttempted` has only just scheduled. Focusing now would move
       * to a control that is not yet described by anything.
       */
      const { field } = blockers[0];

      requestAnimationFrame(() => document.getElementById(field)?.focus());
    },
    [blockers],
  );

  const reset = useCallback(() => setAttempted(false), []);

  return { attempted, issueFor, blockers, costly, attemptSubmit, reset };
}

/**
 * "Two fields need fixing before this can go out" — frame `22`'s summary
 * headline, which counts rather than lists, with the labels underneath.
 */
export function describeBlockerCount(count: number): string {
  const written = ['No', 'One', 'Two', 'Three', 'Four', 'Five'][count] ?? String(count);

  return `${written} ${count === 1 ? 'field needs' : 'fields need'} fixing before this can go out`;
}
