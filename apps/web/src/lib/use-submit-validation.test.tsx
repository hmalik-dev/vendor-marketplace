import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  describeBlockerCount,
  useSubmitValidation,
  type FieldIssue,
} from './use-submit-validation';

const guestCount: FieldIssue = {
  field: 'guestCount',
  label: 'Guest count',
  message: 'June covers events up to 300 guests. Enter 300 or fewer.',
  severity: 'blocker',
};

const blockedDate: FieldIssue = {
  field: 'eventDate',
  label: 'Event date',
  message: 'June has this date blocked.',
  severity: 'costly',
};

describe('useSubmitValidation', () => {
  it('says nothing in red until a submit is attempted', () => {
    const { result } = renderHook(() => useSubmitValidation([guestCount]));

    expect(result.current.attempted).toBe(false);
    expect(result.current.issueFor('guestCount')).toBeNull();
  });

  it('shows a gold issue immediately, because it is advice rather than an error', () => {
    const { result } = renderHook(() => useSubmitValidation([blockedDate]));

    expect(result.current.issueFor('eventDate')).toEqual(blockedDate);
  });

  it('reveals red issues on a blocked submit and does not call the handler', () => {
    const onValid = vi.fn();
    const { result } = renderHook(() => useSubmitValidation([guestCount]));

    act(() => result.current.attemptSubmit(onValid));

    expect(onValid).not.toHaveBeenCalled();
    expect(result.current.attempted).toBe(true);
    expect(result.current.issueFor('guestCount')).toEqual(guestCount);
  });

  it('submits when only gold issues remain', () => {
    const onValid = vi.fn();
    const { result } = renderHook(() => useSubmitValidation([blockedDate]));

    act(() => result.current.attemptSubmit(onValid));

    expect(onValid).toHaveBeenCalledTimes(1);
  });

  it('clears a field message once the value stops producing an issue', () => {
    const onValid = vi.fn();
    const { result, rerender } = renderHook(
      ({ issues }: { issues: FieldIssue[] }) => useSubmitValidation(issues),
      { initialProps: { issues: [guestCount] } },
    );

    act(() => result.current.attemptSubmit(onValid));
    expect(result.current.issueFor('guestCount')).toEqual(guestCount);

    rerender({ issues: [] });

    expect(result.current.issueFor('guestCount')).toBeNull();
    expect(result.current.blockers).toEqual([]);
  });

  it('counts blockers separately from gold advice', () => {
    const { result } = renderHook(() => useSubmitValidation([guestCount, blockedDate]));

    expect(result.current.blockers).toEqual([guestCount]);
    expect(result.current.costly).toEqual([blockedDate]);
  });

  it('goes quiet again on reset', () => {
    const { result } = renderHook(() => useSubmitValidation([guestCount]));

    act(() => result.current.attemptSubmit(vi.fn()));
    act(() => result.current.reset());

    expect(result.current.attempted).toBe(false);
    expect(result.current.issueFor('guestCount')).toBeNull();
  });
});

describe('describeBlockerCount', () => {
  it('writes the count out and agrees the verb', () => {
    expect(describeBlockerCount(1)).toBe('One field needs fixing before this can go out');
    expect(describeBlockerCount(2)).toBe('Two fields need fixing before this can go out');
  });

  it('falls back to digits past the written range', () => {
    expect(describeBlockerCount(9)).toBe('9 fields need fixing before this can go out');
  });
});
