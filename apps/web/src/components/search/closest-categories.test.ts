import { describe, expect, it } from 'vitest';
import { closestCategories, CLOSEST_CATEGORY_COUNT } from './closest-categories';

const CATEGORIES = [
  { id: '1', name: 'Photography', slug: 'photography' },
  { id: '2', name: 'Videography', slug: 'videography' },
  { id: '3', name: 'Catering', slug: 'catering' },
  { id: '4', name: 'Florals', slug: 'florals' },
  { id: '5', name: 'Entertainment', slug: 'entertainment' },
  { id: '6', name: 'Venues', slug: 'venues' },
] as const;

const names = (input: string): string[] =>
  closestCategories(CATEGORIES, input).map((category) => category.name);

describe('closestCategories', () => {
  it('offers nothing for an empty query — the full list is already shown', () => {
    expect(closestCategories(CATEGORIES, '')).toEqual([]);
    expect(closestCategories(CATEGORIES, '   ')).toEqual([]);
  });

  it('puts a prefix match first', () => {
    expect(names('photo')[0]).toBe('Photography');
  });

  it('finds a category by a fragment from the middle of its name', () => {
    expect(names('graph')).toContain('Photography');
    expect(names('graph')).toContain('Videography');
  });

  it('still suggests something for a typo, so the field is never a dead end', () => {
    expect(names('photograpy')).toContain('Photography');
  });

  it('suggests the closest few rather than the whole taxonomy', () => {
    expect(closestCategories(CATEGORIES, 'e').length).toBeLessThanOrEqual(CLOSEST_CATEGORY_COUNT);
  });

  it('offers exactly three when the taxonomy is bigger than that', () => {
    expect(closestCategories(CATEGORIES, 'e')).toHaveLength(CLOSEST_CATEGORY_COUNT);
  });

  /*
   * "wedding photographer near me" is exactly the string the old free-text box
   * invited. The field cannot hold it, so the least it can do is name the
   * category the person meant.
   */
  it('recovers the category from a phrase the retired text box would have taken', () => {
    expect(names('wedding photographer near me')).toContain('Photography');
  });

  it('is case-insensitive', () => {
    expect(names('CATERING')[0]).toBe('Catering');
  });

  it('returns an empty list when nothing is remotely close', () => {
    expect(closestCategories(CATEGORIES, 'zzzzzzzz')).toEqual([]);
  });
});
