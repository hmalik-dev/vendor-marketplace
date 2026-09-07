import { describe, expect, it } from 'vitest';
import { sourceFiles, TS_AND_TSX, WEB_SOURCE } from '@/testing/source-scan';

/*
 * Acceptance 6 of #427: **no cookie consent mechanism exists anywhere** —
 * asserted, not merely absent.
 *
 * The cookie notice states, as a fact about this codebase, that there is no
 * banner because there is nothing to consent to: the tree sets no cookies of
 * its own and loads no analytics, advertising or session-recording script, so
 * the only cookie is Clerk's strictly-necessary `__session`. That claim stops
 * being true the moment somebody adds a tracker, and the page would go on
 * saying it. This is the guard that fails first.
 *
 * It is deliberately a source scan rather than a rendered assertion. A consent
 * banner that never mounts is still a consent banner, and a `gtag` snippet in a
 * layout renders nothing at all in jsdom.
 */

const source = await sourceFiles(WEB_SOURCE, TS_AND_TSX);

/**
 * The scripts a consent banner would exist to cover.
 *
 * Written as the vendors rather than as "analytics", because the word is what a
 * reviewer skims past — `gtag` in a layout is what actually changes the answer.
 * `posthog` and friends appear nowhere in this tree today; the point is that
 * adding one fails here and sends the author to `content/legal/cookies.md`.
 *
 * Word-bounded, because a bare substring is a guard that cries wolf: `gtag`
 * sits inside `pendingTagSuggestionsCount` on the admin overview, and a guard
 * that fails on an unrelated identifier is one somebody deletes.
 */
const TRACKERS = [
  /\bgtag\b/i,
  /googletagmanager/i,
  /google-analytics/i,
  /\bposthog\b/i,
  /segment\.com/i,
  /analytics\.js/i,
  /\bhotjar\b/i,
  /\bmixpanel\b/i,
  /\bfullstory\b/i,
  /clarity\.ms/i,
];

/**
 * The shapes a consent mechanism takes. All three are needed: the banner is the
 * visible half, the stored decision is the half that survives a reload, and the
 * preferences modal is the one somebody adds later "just to be thorough".
 */
const CONSENT = [
  /cookie[-_ ]?consent/i,
  /cookie[-_ ]?banner/i,
  /cookie[-_ ]?preferences/i,
  /consent[-_ ]?(?:mode|manager|state|given)/i,
];

describe('there is no cookie consent mechanism, because there is nothing to consent to', () => {
  it('scans a plausible number of files, so it cannot pass on an empty walk', () => {
    expect(source.length).toBeGreaterThan(100);
  });

  it('loads no analytics, advertising or session-recording script', () => {
    const offenders = source.flatMap((file) =>
      TRACKERS.filter((tracker) => tracker.test(file.code)).map(
        (tracker) => `${file.name}: ${tracker.source}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('has no consent banner, modal or stored consent state', () => {
    const offenders = source.flatMap((file) =>
      CONSENT.filter((pattern) => pattern.test(file.code)).map(
        (pattern) => `${file.name}: ${pattern.source}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * The other half of the claim: the product writes no cookie of its own.
   *
   * Clerk sets `__session` from its own package inside `node_modules`, which
   * this scan does not read — so a cookie written in *this* tree is, by
   * construction, one the notice does not name.
   *
   * **The shapes matter more than the list does.** This asserted
   * `cookies().set(` for a while, which under Next 15 cannot appear at all:
   * `cookies()` returns a Promise, so that expression is a type error and the
   * check could never fail. The three forms actually reachable are the awaited
   * store, a destructured one, and `NextResponse.cookies.set` in
   * `middleware.ts` — the one file here that runs on every request. A check
   * nothing could trip is not a check.
   */
  const COOKIE_WRITES = [
    /document\.cookie\s*=/i,
    /['"]set-cookie['"]/i,
    /\.cookies\s*\.set\s*\(/i,
    /\bcookieStore\s*\.set\s*\(/i,
    /await\s+cookies\s*\(\s*\)\s*\)?\s*\.set\s*\(/i,
  ];

  it('writes no cookie of its own', () => {
    const offenders = source.flatMap((file) =>
      COOKIE_WRITES.filter((pattern) => pattern.test(file.code)).map(
        (pattern) => `${file.name}: ${pattern.source}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * And the guard above can actually fail — asserted rather than assumed, for
   * the reason its own comment gives.
   */
  it('would catch each of the three shapes a cookie is set in', () => {
    const written = [
      "document.cookie = 'a=b'",
      "headers.set('Set-Cookie', 'a=b')",
      "response.cookies.set('a', 'b')",
      "cookieStore.set('a', 'b')",
      "(await cookies()).set('a', 'b')",
    ];

    for (const shape of written) {
      expect([shape, COOKIE_WRITES.some((pattern) => pattern.test(shape))]).toEqual([shape, true]);
    }
  });
});
