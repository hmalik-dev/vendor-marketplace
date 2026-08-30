import { describe, expect, it } from 'vitest';
import { containsProfanity } from './profanity.js';

describe('containsProfanity', () => {
  it('flags a blocked word on its own', () => {
    expect(containsProfanity('What a load of bullshit.')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(containsProfanity('SHIT show from start to finish')).toBe(true);
  });

  it('does not flag a clean review', () => {
    expect(containsProfanity('Outstanding work from start to finish, would book again.')).toBe(
      false,
    );
  });

  it('does not flag a word that merely contains a blocked substring', () => {
    // "class" contains no blocked word, but a naive substring filter on
    // "ass" would wrongly flag it — this is the case that matters.
    expect(containsProfanity('A very classy operation, top of their class.')).toBe(false);
  });

  it('checks every argument passed in', () => {
    expect(containsProfanity('A fine title', 'but a fucking awful shoot')).toBe(true);
  });

  it('tolerates null and undefined arguments', () => {
    expect(containsProfanity(null, undefined, 'Lovely, would recommend.')).toBe(false);
  });
});
