import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStableValue } from './use-stable-value';

/**
 * The hook's whole contract is an identity, which nothing on screen shows — so
 * the probe counts the renders on which the identity actually changed. That
 * count is the assertion, and it is what would fail: a hook that simply
 * returned `value` would count one per render in every case below.
 */
let identityChanges = 0;

function Probe<T>({ value }: { value: T }): null {
  const stable = useStableValue(value);
  const previous = useRef<T | undefined>(undefined);

  if (previous.current !== stable) {
    previous.current = stable;
    identityChanges += 1;
  }

  return null;
}

describe('useStableValue', () => {
  afterEach(() => {
    cleanup();
    identityChanges = 0;
  });

  it('keeps its identity when a rebuilt object holds the same contents', () => {
    const { rerender } = render(<Probe value={{ min: 1, max: 2 }} />);
    expect(identityChanges).toBe(1);

    rerender(<Probe value={{ min: 1, max: 2 }} />);
    rerender(<Probe value={{ min: 1, max: 2 }} />);

    expect(identityChanges).toBe(1);
  });

  it('changes its identity when any field changes', () => {
    const { rerender } = render(<Probe value={{ min: 1, max: 2 }} />);

    rerender(<Probe value={{ min: 1, max: 3 }} />);

    expect(identityChanges).toBe(2);
  });

  /*
   * The failure mode the enumerated dep lists had: a field added to the value
   * and forgotten in the deps simply stops being carried, with no lint error
   * and no failing test. The key is the whole value, so a new field is covered
   * the day it appears.
   */
  it('notices a field the caller never had to enumerate', () => {
    const { rerender } = render(<Probe value={{ min: 1, max: 2 }} />);

    rerender(<Probe value={{ min: 1, max: 2, step: 5 }} />);

    expect(identityChanges).toBe(2);
  });

  it('tracks a list by its contents, not by the array', () => {
    const { rerender } = render(<Probe value={['a', 'b']} />);

    rerender(<Probe value={['a', 'b']} />);
    expect(identityChanges).toBe(1);

    rerender(<Probe value={['a', 'b', 'c']} />);
    expect(identityChanges).toBe(2);
  });

  /* Order is contents too — a reordered selection is a different selection. */
  it('treats a reordering as a change', () => {
    const { rerender } = render(<Probe value={['b', 'a']} />);

    rerender(<Probe value={['a', 'b']} />);

    expect(identityChanges).toBe(2);
  });

  it('handles a primitive without ceremony', () => {
    const { rerender } = render(<Probe value="photography" />);

    rerender(<Probe value="photography" />);
    expect(identityChanges).toBe(1);

    rerender(<Probe value="catering" />);
    expect(identityChanges).toBe(2);
  });
});
