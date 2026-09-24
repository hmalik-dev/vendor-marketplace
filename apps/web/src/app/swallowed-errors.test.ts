import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * #368 — a rejection may be hidden from the customer, never from everyone.
 *
 * `search-shell.tsx` swallowed a failed `/vendors` request with a bare
 * `.catch(() => {})`. With the API answering 429 the page rendered the ordinary
 * `0 vendors` empty-result heading, the console stayed clean, and nothing
 * anywhere distinguished "the search backend is down" from "nobody matches your
 * filters".
 *
 * That is worse than a visible error, because it defeats verification: a
 * browser pass driving `/search` against a broken API sees a plausible page and
 * reports green. The same shape was in four other data paths.
 *
 * Hiding a failure from the *screen* is often right — a supplementary band
 * should not put an error on top of a dead end, and an upstream message written
 * for a log says nothing a customer can act on. So this does not ban the
 * pattern. It requires that a swallow leaves a trace, via
 * `reportSwallowedError`, and the justification beside it.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

/**
 * A handler that discards its argument and does nothing observable:
 * `.catch(() => {})`, `.catch(() => undefined)`, `.catch(() => null)`.
 *
 * Deliberately narrow. A handler that takes the error and calls something is
 * not matched, because that is the shape being asked for — the point is to
 * catch the *empty* body, not to police every catch in the codebase.
 */
const SILENT_CATCH = /\.catch\(\s*\(\s*\)\s*=>\s*(\{\s*\}|undefined|null)\s*\)/;

function relative(path: string): string {
  return path.replace(`${process.cwd()}/`, '');
}

describe('swallowed errors', () => {
  it('leaves no rejection handler that discards the failure entirely', () => {
    const offenders = sourceFiles(SOURCE_ROOT).filter((path) =>
      SILENT_CATCH.test(readFileSync(path, 'utf8')),
    );

    expect(
      offenders.map(relative),
      'a rejection may be hidden from the customer, but not from the console — ' +
        'call reportSwallowedError from @/lib/report-error and say beside it why ' +
        'the screen stays quiet',
    ).toEqual([]);
  });

  /*
   * The guard above only fires on the *empty* shape, so a catch with a body
   * that still reports nothing would pass it. This is the complementary half:
   * every file that catches and deliberately shows the user nothing has to
   * name the reporter. It is asserted as a set rather than a count, so adding a
   * legitimate silent path means adding it here on purpose.
   */
  it('reports from every data path that catches without telling the user', () => {
    const expected = [
      // #387: the checkout's error screen reads the request to tell an
      // unaccepted booking from a closed one. That read carries #390's
      // server-side deadline, and a timeout must not turn the screen that
      // explains a failure into the 500 boundary — so it falls back to the
      // vaguer of the two variants and logs why.
      'src/app/bookings/[requestId]/checkout/(gate)/page.tsx',
      // VEN-711: a failed reviews read is hidden from the list but *shown* as its error banner with a Try again, and reported.
      'src/app/customer/profile/page.tsx',
      // VEN-680: a sign-out the provider could not take after a closure changes nothing for the person, and is reported.
      'src/components/account/close-account-form.tsx',
      // VEN-540: a rejected `confirmPayment` shows its own banner; the cause is reported.
      'src/components/checkout/checkout-screen.tsx',
      // VEN-706: a failed unread read leaves the header's dot at its last value
      // rather than drawing an error in the nav bar, and reports why.
      'src/components/messaging/messages-link.tsx',
      'src/components/messaging/messages-screen.tsx',
      'src/components/messaging/notification-bell.tsx',
      'src/components/search/nearby-dates-band.tsx',
      'src/components/search/search-shell.tsx',
      // A malformed 403 body on the auth proxy is the proxy or Better Auth
      // itself misbehaving, not an ordinary refusal — the fallback below
      // reads as "email not verified", exactly the shape #368 exists to
      // catch, so a parse failure here still leaves a trace.
      'src/lib/auth/auth-requests.ts',
      // #402: a failed conversation-list read is hidden from the two
      // supplementary bands that draw it beside a booking, and *shown* on
      // `/messages`, where the list is the whole screen — which is exactly the
      // distinction this file exists to force. Both paths leave the trace.
      'src/lib/messaging-data.ts',
      // #384: the City typeahead's suggestion request. It degrades to "no
      // suggestions", which is the same panel a genuine no-match draws — so an
      // API that is refusing every request looks exactly like a customer
      // mistyping every city name, on a field that is on every page.
      'src/lib/use-place-suggestions.ts',
    ];

    const reporting = sourceFiles(SOURCE_ROOT)
      .filter((path) => /reportSwallowedError\(/.test(readFileSync(path, 'utf8')))
      .map(relative)
      .filter((path) => path !== 'src/lib/report-error.ts')
      .sort();

    expect(reporting).toEqual(expected);
  });

  /*
   * The reporter must not be the thing that hides the failure. If it ever stops
   * writing to the console, every call site above goes silent at once and this
   * whole guard becomes decorative.
   */
  it('reports through the console, which is the channel a browser pass reads', () => {
    const source = readFileSync(join(SOURCE_ROOT, 'lib/report-error.ts'), 'utf8');

    expect(source).toMatch(/console\.error\(/);
  });
});
