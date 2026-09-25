import type { Page } from '@playwright/test';

/** Documents, RSC payloads and API calls; scripts, styles, fonts and images are noise here. */
const LOGGED_RESOURCES = new Set(['document', 'fetch', 'xhr', 'eventsource']);

/** Origin and path: the query string is where a stream ticket and Stripe's client secret travel. */
export function withoutQuery(url: string): string {
  const parsed = new URL(url);

  return `${parsed.origin}${parsed.pathname}`;
}

/**
 * Next sends `RSC: 1` on a prefetch and on a `router.refresh()` alike; only the
 * prefetch also sends `Next-Router-Prefetch`, and the refresh is what a stalled
 * page needs told apart.
 */
function rscKind(headers: Record<string, string>): string {
  if (headers['rsc'] !== '1') {
    return '';
  }

  return headers['next-router-prefetch'] === '1' ? ' (RSC prefetch)' : ' (RSC)';
}

/**
 * Records what a page asks the web and the API for, in order, for a failure to
 * attach.
 *
 * CI runs without traces (`playwright.config.ts`: a trace records the accounts'
 * session cookies), so a journey that fails in CI and nowhere else left only a
 * screenshot. The paid-booking refund once stood 30s on the booked view after a
 * cancel the API had answered 200 (VEN-779), and nothing recorded whether the
 * page's `router.refresh()` was ever sent or answered. This keeps method, path
 * and status only: no header, no body and no query string, so nothing that
 * grants access reaches the uploaded report.
 *
 * Returns the live log; it grows as the page runs.
 */
export function recordExchanges(page: Page, now: () => number = Date.now): string[] {
  const log: string[] = [];
  const started = now();
  const note = (line: string): void => {
    log.push(`+${now() - started}ms ${line}`);
  };

  page.on('request', (request) => {
    if (LOGGED_RESOURCES.has(request.resourceType())) {
      note(`→ ${request.method()} ${withoutQuery(request.url())}${rscKind(request.headers())}`);
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    if (LOGGED_RESOURCES.has(request.resourceType())) {
      note(`← ${response.status()} ${request.method()} ${withoutQuery(response.url())}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (LOGGED_RESOURCES.has(request.resourceType())) {
      note(
        `✗ ${request.method()} ${withoutQuery(request.url())} ${request.failure()?.errorText ?? ''}`,
      );
    }
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      note(`URL ${withoutQuery(frame.url())}`);
    }
  });

  return log;
}
