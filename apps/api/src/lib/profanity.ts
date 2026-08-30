/**
 * A lightweight profanity filter for review text.
 *
 * Not a hard blocker for MVP — the ticket asks for a basic word list rather
 * than a moderation service, so this is deliberately small and deterministic:
 * no network call, no third-party word list to keep in sync, nothing to
 * configure. It exists to catch the obvious case, not to be exhaustive.
 *
 * Matching is whole-word and case-insensitive, so "class" does not trip on a
 * substring inside it — a naive `includes()` check does, and that is the
 * commonest false positive this kind of filter produces.
 */
const BLOCKED_WORDS = [
  'asshole',
  'bastard',
  'bitch',
  'bullshit',
  'cunt',
  'dumbass',
  'fuck',
  'fucking',
  'motherfucker',
  'nigger',
  'piss off',
  'prick',
  'retard',
  'shit',
  'slut',
  'twat',
  'whore',
] as const;

function toPattern(word: string): RegExp {
  // A phrase like "piss off" carries its own space, so `\b...\b` still anchors
  // on real word boundaries at each end rather than requiring one mid-phrase.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

const PATTERNS = BLOCKED_WORDS.map(toPattern);

/** Whether any text contains a word from the blocked list. */
export function containsProfanity(...texts: readonly (string | null | undefined)[]): boolean {
  return texts.some(
    (text) => text !== null && text !== undefined && PATTERNS.some((pattern) => pattern.test(text)),
  );
}
