import { validationFailed } from './errors.js';

/**
 * Validates a client-supplied reorder before any row is written.
 *
 * A reorder is only meaningful as a complete list: positions are the list
 * indices, so a partial list would give the omitted rows stale positions that
 * collide with the reordered ones. The three failures are separated because
 * "you sent a duplicate", "you named something that is not yours", and "you
 * left one out" are different mistakes with different fixes.
 */
export function assertCompleteOrder(
  submittedIds: readonly string[],
  ownedIds: readonly string[],
  totalOwned: number,
  noun: string,
): string[] {
  const unique = [...new Set(submittedIds)];

  if (unique.length !== submittedIds.length) {
    throw validationFailed(`Each ${noun} may appear only once in the order.`);
  }
  if (ownedIds.length !== unique.length) {
    throw validationFailed(`That order names a ${noun} you do not own.`);
  }
  if (totalOwned !== unique.length) {
    throw validationFailed(`Send every one of your ${noun}s in the new order.`);
  }

  return unique;
}
