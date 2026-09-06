import { describe, expect, it } from 'vitest';
import { successorSearchPath } from './search-params';

/**
 * #419 folded Florals into Decor. The links that pointed at the retired
 * category are already out in the world — in somebody's messages, in a
 * bookmark, in the footer of an email — and the failure this guards is the
 * quiet one: a 200 with an empty result grid, which reads as a marketplace
 * with no florists rather than a category that moved.
 */
describe('successorSearchPath', () => {
  it('sends a retired category to the survivor', () => {
    expect(successorSearchPath({ category: 'florals' })).toBe('/search?category=decor');
  });

  it('keeps every other filter in the shared link', () => {
    expect(successorSearchPath({ category: 'florals', city: 'Austin', date: '2026-07-30' })).toBe(
      '/search?city=Austin&date=2026-07-30&category=decor',
    );
  });

  it('leaves a category that is still seeded alone', () => {
    expect(successorSearchPath({ category: 'decor' })).toBeNull();
    expect(successorSearchPath({ category: 'photography', city: 'Austin' })).toBeNull();
  });

  it('leaves a search with no category alone', () => {
    expect(successorSearchPath({})).toBeNull();
    expect(successorSearchPath({ city: 'Austin' })).toBeNull();
  });

  /*
   * A slug we never shipped has told us nothing about where its vendors went,
   * so search answers it the way it answers any filter that matches nothing —
   * with its own no-results diagnosis, which names the filter.
   */
  it('does not guess a destination for a slug that never existed', () => {
    expect(successorSearchPath({ category: 'petting-zoos' })).toBeNull();
    expect(successorSearchPath({ category: '' })).toBeNull();
  });

  /*
   * `?category=constructor` reaching a plain object lookup would resolve to
   * `Object`'s own and redirect to `/search?category=function%20Object`.
   */
  it('never reads a destination off the prototype chain', () => {
    for (const slug of ['constructor', 'toString', '__proto__']) {
      expect(successorSearchPath({ category: slug }), slug).toBeNull();
    }
  });

  it('reads the first value when a category is repeated', () => {
    expect(successorSearchPath({ category: ['florals', 'catering'] })).toBe(
      '/search?category=decor',
    );
  });

  it('carries a repeated non-category parameter across in full', () => {
    expect(successorSearchPath({ category: 'florals', tags: ['vegan', 'halal'] })).toBe(
      '/search?tags=vegan&tags=halal&category=decor',
    );
  });

  it('encodes a value rather than pasting it into the query', () => {
    expect(successorSearchPath({ category: 'florals', city: 'St. Louis & Co' })).toBe(
      '/search?city=St.+Louis+%26+Co&category=decor',
    );
  });
});
