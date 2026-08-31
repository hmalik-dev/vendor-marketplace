/**
 * Leave a trace when a failure is deliberately not shown to the customer.
 *
 * Several data paths swallow a rejection on purpose, and the reasons are good:
 * a supplementary band that fails should not put an error on top of a screen
 * that already stands on its own, and an upstream message written for a log
 * says nothing a customer can act on. What is *not* good is that the failure
 * then leaves no trace anywhere — not on the page, not in the console.
 *
 * **That is what defeats verification.** `/search` against an API returning 429
 * rendered the ordinary `0 vendors` empty-result heading with a clean console,
 * so a browser pass driving it saw a plausible page and reported green. A
 * backend outage was indistinguishable from "nobody matches your filters", and
 * nothing on the machine said otherwise (#368).
 *
 * The console is the right channel for it: it reaches a developer, a browser
 * agent and a session replay, and it reaches none of them through the UI. This
 * is deliberately *not* a user-facing mechanism — call it in addition to
 * whatever the screen does, never instead of it.
 */
export function reportSwallowedError(context: string, error: unknown): void {
  // An abort is not a failure. Cancelling an in-flight request is how the
  // search box avoids a stale response overwriting a fresh one, so logging it
  // would fire on ordinary typing and train everyone to ignore this channel.
  if (isAbort(error)) {
    return;
  }

  /*
   * `console` is deliberate and is the whole point of this module. It is also
   * permitted: `apps/web` extends `next/core-web-vitals` rather than the repo
   * base config, so `no-console` is not enforced here — a disable directive
   * would itself be flagged as unused.
   */
  console.error(`[swallowed] ${context}`, error);
}

/**
 * `AbortController.abort()` rejects with a `DOMException` named `AbortError` in
 * the browser; `signal.aborted` is checked at most call sites, but not all, and
 * a helper that only works when the caller already filtered is not much of a
 * helper.
 */
function isAbort(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}
