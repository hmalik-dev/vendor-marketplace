/**
 * Moves one item to a new index, returning a new array. Out-of-range indices
 * return the list unchanged rather than throwing: a drop outside the list is an
 * ordinary gesture, not an error the caller should have to guard.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) {
    return [...items];
  }

  next.splice(to, 0, moved);
  return next;
}
