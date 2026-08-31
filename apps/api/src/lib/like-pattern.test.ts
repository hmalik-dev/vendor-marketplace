import { describe, expect, it } from 'vitest';
import { escapeLikePattern } from './like-pattern.js';

describe('escapeLikePattern', () => {
  it('leaves an ordinary term untouched', () => {
    expect(escapeLikePattern('kessler')).toBe('kessler');
  });

  it('neutralises the wildcard that would dump the whole table', () => {
    // The class of defect: `?q=%` returned every row before this existed.
    expect(escapeLikePattern('%')).toBe('\\%');
    expect(escapeLikePattern('a%b')).toBe('a\\%b');
  });

  it('neutralises the single-character wildcard too', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapes the backslash first, so it does not escape the escapes', () => {
    // `\%` must become `\\\%` — a literal backslash and a literal percent —
    // not `\\%`, which is a literal backslash followed by a live wildcard.
    expect(escapeLikePattern('\\%')).toBe('\\\\\\%');
  });

  it('handles a term that is nothing but syntax', () => {
    expect(escapeLikePattern('%_\\')).toBe('\\%\\_\\\\');
  });
});
