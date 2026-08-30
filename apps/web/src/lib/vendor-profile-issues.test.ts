import { ERROR_CODES } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-client';
import {
  controlIdForStateKey,
  mergeProblems,
  problemFromSaveError,
  problemFromValidationIssues,
} from './vendor-profile-issues';

describe('problemFromValidationIssues', () => {
  it('puts a schema failure on the control that owns the payload key', () => {
    const problem = problemFromValidationIssues([
      { path: ['businessName'], message: 'Enter your business name' },
    ]);

    expect(problem.fields).toEqual([
      {
        field: 'businessName',
        label: 'Business name',
        message: 'Enter your business name',
        severity: 'blocker',
      },
    ]);
    expect(problem.formMessage).toBeNull();
  });

  /*
   * The picker's control id is not its payload key, and the summary links by
   * control id — a mismatch here is an anchor that scrolls nowhere.
   */
  it('maps categoryIds to the category picker, not to a control called categoryIds', () => {
    const problem = problemFromValidationIssues([
      { path: ['categoryIds'], message: 'Select at least one category' },
    ]);

    expect(problem.fields[0]?.field).toBe('categories');
    expect(problem.fields[0]?.label).toBe('Categories');
  });

  /** The summary reads top to bottom, so it must not read in Zod's order. */
  it('orders issues the way the form is laid out, not the way they arrived', () => {
    const problem = problemFromValidationIssues([
      { path: ['city'], message: 'Enter the city you serve' },
      { path: ['businessName'], message: 'Enter your business name' },
      { path: ['categoryIds'], message: 'Select at least one category' },
    ]);

    expect(problem.fields.map((issue) => issue.field)).toEqual([
      'businessName',
      'categories',
      'city',
    ]);
  });

  /*
   * A message with nowhere to go must still be said. Dropping it is exactly the
   * defect #222 records — a refusal the vendor never sees.
   */
  it('keeps an unmappable issue as a form-level message rather than dropping it', () => {
    const problem = problemFromValidationIssues([
      { path: ['latitude'], message: 'Latitude is out of range' },
    ]);

    expect(problem.fields).toEqual([]);
    expect(problem.formMessage).toBe('Latitude is out of range');
  });

  it('reports nothing for a payload that parsed', () => {
    expect(problemFromValidationIssues([])).toEqual({ fields: [], formMessage: null });
  });
});

describe('problemFromSaveError', () => {
  it('puts a field-attributed 400 on that field, with the API message', () => {
    const problem = problemFromSaveError(
      new ApiClientError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'One or more selected categories are unavailable. Reload the page and choose from the current list.',
        { field: 'categoryIds' },
      ),
    );

    expect(problem.fields).toEqual([
      {
        field: 'categories',
        label: 'Categories',
        message:
          'One or more selected categories are unavailable. Reload the page and choose from the current list.',
        severity: 'blocker',
      },
    ]);
    expect(problem.formMessage).toBeNull();
  });

  it('attributes a tag refusal to the tag picker', () => {
    const problem = problemFromSaveError(
      new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'One or more selected tags are…', {
        field: 'tagIds',
      }),
    );

    expect(problem.fields[0]?.field).toBe('tags');
  });

  it('falls back to a form-level message when the API names no field', () => {
    const problem = problemFromSaveError(
      new ApiClientError(
        409,
        ERROR_CODES.CONFLICT,
        'That business name is already taken. Try a different one.',
      ),
    );

    expect(problem.fields).toEqual([]);
    expect(problem.formMessage).toBe('That business name is already taken. Try a different one.');
  });

  /** A field the client does not lay out is still a refusal the vendor must see. */
  it('falls back to a form-level message for a field it cannot place', () => {
    const problem = problemFromSaveError(
      new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'Longitude is out of range', {
        field: 'longitude',
      }),
    );

    expect(problem.fields).toEqual([]);
    expect(problem.formMessage).toBe('Longitude is out of range');
  });

  it('never shows a transport failure as if the server had spoken', () => {
    const problem = problemFromSaveError(new TypeError('Failed to fetch'));

    expect(problem.fields).toEqual([]);
    expect(problem.formMessage).toBe(
      'Your profile did not reach us. Check your connection and save again.',
    );
  });
});

describe('mergeProblems', () => {
  const clientIssue = {
    field: 'businessName',
    label: 'Business name',
    message: 'Enter your business name',
    severity: 'blocker',
  } as const;

  it('keeps both halves in screen order', () => {
    const merged = mergeProblems(
      { fields: [{ ...clientIssue, field: 'city', label: 'City' }], formMessage: null },
      {
        fields: [
          { field: 'categories', label: 'Categories', message: 'Gone', severity: 'blocker' },
        ],
        formMessage: null,
      },
    );

    expect(merged.fields.map((issue) => issue.field)).toEqual(['categories', 'city']);
  });

  /*
   * The client's issue was computed from what is on screen now; the server's
   * describes the values as they were sent. Two messages on one control would
   * stack, and the vendor still has only one thing to change.
   */
  it('lets the on-screen issue win a control both halves name', () => {
    const merged = mergeProblems(
      { fields: [clientIssue], formMessage: null },
      {
        fields: [
          { field: 'businessName', label: 'Business name', message: 'Taken', severity: 'blocker' },
        ],
        formMessage: null,
      },
    );

    expect(merged.fields).toEqual([clientIssue]);
  });

  it('prefers the server, which spoke last, for the form-level message', () => {
    const merged = mergeProblems(
      { fields: [], formMessage: 'Latitude is out of range' },
      { fields: [], formMessage: 'That business name is already taken.' },
    );

    expect(merged.formMessage).toBe('That business name is already taken.');
  });
});

describe('controlIdForStateKey', () => {
  it.each([
    ['businessName', 'businessName'],
    ['categoryIds', 'categories'],
    ['tagIds', 'tags'],
    ['serviceRadiusMiles', 'serviceRadius'],
    ['responseTimeHours', 'responseTime'],
  ])('maps the %s form field to its control', (stateKey, controlId) => {
    expect(controlIdForStateKey(stateKey)).toBe(controlId);
  });

  it('returns null for a key no control owns', () => {
    expect(controlIdForStateKey('somethingElse')).toBeNull();
  });
});
