import { describe, expect, it } from 'vitest';
import { moveItem } from './reorder';

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'] as const;

  it('moves an item later in the list', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier in the list', () => {
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves an item to the end', () => {
    expect(moveItem(items, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('returns an equal list when the item does not move', () => {
    expect(moveItem(items, 2, 2)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never mutates the input', () => {
    const original = [...items];
    moveItem(original, 0, 3);
    expect(original).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores an index outside the list', () => {
    expect(moveItem(items, 0, 9)).toEqual(['a', 'b', 'c', 'd']);
    expect(moveItem(items, -1, 1)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty list unchanged', () => {
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});
