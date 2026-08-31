import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKING_REQUEST_EXPIRY_DAYS } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/**
 * The guard D16 asked for, pointed at the plan rather than at the app.
 *
 * `31-content-voice.md` is the approved-strings file: surfaces copy their copy
 * out of it. Its Request reassurance rows read **"48 hours"** from the day the
 * file was written until 2026-08-30, while `BOOKING_REQUEST_EXPIRY_DAYS` has
 * been **7** — so every screen that copied the approved string promised a
 * deadline the API refuses, at the moment of commitment.
 *
 * `one-deadline-one-fee.test.ts` closes the same class inside `apps/web`, but
 * it scans source and this file is prose that nothing imports. That is exactly
 * why the 48-hour row survived: it was never code, so no code guard could see
 * it, and it was approved copy, so every surface that used it was correct to.
 *
 * The rule is narrow on purpose. A duration the code *derives* must appear as a
 * placeholder; a duration that is a plain fact of the world may be written out.
 * The file names both survivors itself — "4 bookings across 2 upcoming events"
 * counts rows rather than naming a window, and the payout gate's "about five
 * minutes" estimates Stripe's onboarding rather than stating a deadline.
 */
const CONTENT_VOICE = join(process.cwd(), '../../design/design-plan/31-content-voice.md');

/**
 * Phrasings that state the booking-request window as a literal.
 *
 * Matched against the approved-string cells only. The same numbers appear
 * legitimately elsewhere in the file — in the prose explaining this very
 * defect, and in `FULL_REFUND_CUTOFF_HOURS`, which is a different fact that
 * genuinely is 48 hours.
 */
const BANNED_WINDOW_PHRASES = [
  /\b(?:48|24|72)\s*hours?\s+to\s+(?:confirm|reply|respond)/i,
  /\b(?:a|one)\s+week\s+to\s+(?:confirm|reply|respond)/i,
  /\bwithin\s+(?:48|24|72)\s*hours?\b/i,
  /\bexpires?\s+in\s+\d+\s*(?:h|d|hours?|days?)\b/i,
  /closes on its own after a week/i,
];

/**
 * The approved string is the last cell of each table row. The first cell names
 * the surface and the second holds the rejected version — which quotes the bad
 * copy deliberately, and must not be read as an instance of it.
 */
function approvedStrings(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|') && line.includes('|', 1))
    .map((line) => line.split('|').slice(1, -1))
    .filter((cells) => cells.length >= 3)
    .map((cells) => (cells.at(-1) as string).trim())
    .filter((cell) => cell.length > 0 && !/^-+$/.test(cell));
}

describe('approved copy states no duration the code derives', () => {
  const markdown = readFileSync(CONTENT_VOICE, 'utf8');

  /*
   * Guards the guard. A parse that returns nothing passes forever while the
   * rule it encodes goes unenforced — the failure this whole ticket exists to
   * stop repeating.
   */
  it('finds the approved-string column it is meant to be reading', () => {
    const approved = approvedStrings(markdown);

    // Measured, not guessed: 30 rows at the time of writing. The floor leaves
    // room for rows to be retired without the guard turning into a row count,
    // while still failing loudly if the parse stops finding the table at all.
    expect(approved.length).toBeGreaterThanOrEqual(25);

    // A count alone cannot tell the approved column from the rejected one —
    // both are populated on every row. Anchoring on a string that exists in
    // only one of them is what proves the right cell is being read.
    expect(approved).toContain(
      '"Browse vendors" — the 500 page cannot know who is reading, so the one destination true for everyone (D17)',
    );
  });

  it('has teeth against the string that actually shipped', () => {
    const shipped = 'Maya has 48 hours to confirm';

    expect(BANNED_WINDOW_PHRASES.some((pattern) => pattern.test(shipped))).toBe(true);
  });

  it('writes no request window as a literal', () => {
    const offenders = approvedStrings(markdown).filter((cell) =>
      BANNED_WINDOW_PHRASES.some((pattern) => pattern.test(cell)),
    );

    expect(offenders).toEqual([]);
  });

  /*
   * The positive half. Banning the literal is only half the ruling — the copy
   * still has to say the thing, and `{expiryDays}` is the placeholder that
   * reads the constant.
   */
  it('carries the placeholder that reads the constant', () => {
    expect(markdown).toContain('{expiryDays}');
  });

  it('states the ruling itself, so the next editor sees the rule', () => {
    expect(markdown).toContain('No approved string hard-codes a duration the code derives.');
  });

  /*
   * If the constant ever becomes 48 hours again, the banned phrasing above
   * stops being wrong and this guard would be enforcing a stale ruling.
   */
  it('is guarding a window the constant still measures in days', () => {
    expect(BOOKING_REQUEST_EXPIRY_DAYS).toBeGreaterThan(1);
  });
});
