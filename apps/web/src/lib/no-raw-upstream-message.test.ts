import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sourceFiles, WEB_SOURCE, withoutComments } from '@/testing/source-scan';

/**
 * `web-route-boundaries.md`: **never render an upstream error string.** The
 * API's error handler emits a small set of generic messages — `Request failed`,
 * `Internal server error`, a client-internal schema complaint — and
 * `user-facing-error.ts` exists to keep those off the screen. `40-states.md`
 * requires an error to say what happened in the reader's words and offer one
 * action, and none of those shapes does either half.
 *
 * Four mutation forms reached around it anyway and rendered
 * `ApiClientError.message` verbatim into a `role="alert"` (#405), on the money
 * paths most likely to 500. A written rule had not stopped that, so this is the
 * executable form of it: the leak has a source shape, and a source shape can be
 * grepped.
 *
 * The rule is not "never read `.message`" — the product writes real messages
 * and those are the ones `40-states.md` wants shown. It is that the read must
 * **reach a filter**, and the check is per-occurrence rather than per-file: a
 * component that routes one branch through `userFacingError` and leaks raw in
 * the next is exactly the shape a whole-file "does it import the helper?" test
 * would wave through, and `request-row.tsx` is one edit away from being it.
 */
const COMPONENTS = path.join(WEB_SOURCE, 'components');

/** The calls that know which messages are safe to show a person. */
const FILTERS = ['userFacingError', 'isUpstreamErrorShape', 'rejectedFailure'];

/**
 * Every `<name>.message` read off a value the file narrowed with `instanceof
 * ApiClientError`, that is **not** an argument to one of the filters.
 *
 * The narrowed binding's name is read out of the source rather than assumed:
 * the four offenders used two different names between them, and a hard-coded
 * pair would have missed a third.
 */
export function rawUpstreamMessageReads(code: string): string[] {
  const narrowed = new Set(
    [...code.matchAll(/(\w+)\s+instanceof\s+ApiClientError/g)].map((match) => match[1]!),
  );
  const leaks: string[] = [];

  for (const name of narrowed) {
    for (const match of code.matchAll(new RegExp(`\\b${name}\\.message\\b`, 'g'))) {
      /*
       * A filter takes the read as its first argument, so the call opens
       * immediately before it. Looking back one short window rather than
       * parsing: enough to tell `userFacingError(failure.message` from a bare
       * `setError(failure.message`, and it cannot span a statement break.
       */
      const before = code.slice(Math.max(0, match.index - 60), match.index);
      if (!FILTERS.some((filter) => before.includes(`${filter}(`))) {
        leaks.push(name);
      }
    }
  }

  return leaks;
}

const files = await sourceFiles(COMPONENTS);

describe('no component renders an upstream error message verbatim', () => {
  it('finds none', () => {
    const offenders = files
      .filter((file) => rawUpstreamMessageReads(file.code).length > 0)
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  /*
   * What would make this fail. Without it the check passes on a directory it
   * could not read, or on a regex that matches nothing — the failure mode
   * `web-design-parity.md` names: a check confidently reporting something it
   * never established.
   */
  it('scans a real, non-empty set of components', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('sees the files that actually narrow on ApiClientError', () => {
    const narrowing = files.filter((file) => file.code.includes('instanceof ApiClientError'));

    expect(narrowing.length).toBeGreaterThan(0);
  });

  it('catches the shape the four forms actually used', () => {
    const leak = [
      'const message = failure instanceof ApiClientError',
      '  ? failure.message',
      "  : 'That did not reach us.';",
    ].join('\n');

    expect(rawUpstreamMessageReads(leak)).toEqual(['failure']);
  });

  it('leaves the sanctioned route alone', () => {
    const fixed = [
      'if (!(failure instanceof ApiClientError)) return fallback;',
      'return userFacingError(failure, fallback);',
    ].join('\n');

    expect(rawUpstreamMessageReads(fixed)).toEqual([]);
  });

  /*
   * The per-occurrence half. A file that filters one branch and leaks the next
   * is the regression a whole-file import check cannot see.
   */
  it('catches a leak beside a filtered branch in the same file', () => {
    const mixed = [
      "if (error instanceof ApiClientError) setA(userFacingError(error, 'x'));",
      'if (error instanceof ApiClientError) setB(error.message);',
    ].join('\n');

    expect(rawUpstreamMessageReads(mixed)).toEqual(['error']);
  });

  it('does not fire on a comment that quotes the bad shape', () => {
    const commented = withoutComments(
      '// use userFacingError, not failure.message\nif (x instanceof ApiClientError) {}',
    );

    expect(rawUpstreamMessageReads(commented)).toEqual([]);
  });
});
