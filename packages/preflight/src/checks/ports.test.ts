import { describe, expect, it } from 'vitest';
import { parseHolders } from './ports.js';

describe('parseHolders', () => {
  it('pairs each pid with its command', () => {
    expect(parseHolders('p1234\ncnode\np5678\ncPython\n')).toEqual([
      { pid: '1234', command: 'node' },
      { pid: '5678', command: 'Python' },
    ]);
  });

  it('returns nothing when the port is free', () => {
    expect(parseHolders('')).toEqual([]);
  });

  it('ignores a command line with no pid before it', () => {
    expect(parseHolders('cnode\n')).toEqual([]);
  });
});
