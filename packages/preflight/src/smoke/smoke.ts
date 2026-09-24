/**
 * The post-deploy smoke check.
 *
 * It exists because the API served 500 on every route for about nineteen hours
 * while the platform reported the deployment **Ready**. A build that compiles
 * but never invokes a route cannot see a broken runtime export, and both
 * failures that day — no default export, then one that returned the app instead
 * of answering — would have been caught by a single request.
 */

import { API_VERSION_PREFIX } from '@vendor-marketplace/shared';

export interface SmokeOptions {
  apiUrl: string;
  webUrl: string;
  /**
   * The commit this check was triggered for.
   *
   * Without it, a check run seconds after a push is answered by the *previous*
   * release — still healthy, still ready — and reports success while the new
   * build crash-loops behind it. With it, the check waits for `/ready` to name
   * this commit before it believes anything the deployment says.
   */
  expectCommit?: string;
  /** Whole-check deadline. A check that waits forever reproduces the bug. */
  deadlineMs?: number;
  /** Per-request timeout. The second outage presented as a hang, not an error. */
  requestTimeoutMs?: number;
  /** Gap between attempts while a deploy is still building. */
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface SmokeResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

const DEFAULTS = {
  deadlineMs: 180_000,
  requestTimeoutMs: 10_000,
  retryDelayMs: 5_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One request with a hard ceiling.
 *
 * **A timeout is a failure, never a pass.** The outage this check exists for
 * hung rather than erroring, so a request with no ceiling would have waited
 * alongside it instead of reporting it.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    const body = await response.text();

    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';

    return { ok: false, status: 0, body: reason === 'AbortError' ? 'timed out' : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the smoke check.
 *
 * Three steps, in order, because each depends on the one before:
 *
 * 1. **`/ready`, not `/health`** — readiness round-trips the database and the
 *    object store, where liveness can pass with a dependency unreachable.
 * 2. Read a real vendor's name and slug **from the API**, so the assertion
 *    below is not a hardcoded string that goes stale as the data changes.
 * 3. Require that vendor's **web** profile page to contain that name. Since
 *    #33, a public page returns 200 during an API outage, so status alone
 *    stopped being evidence of health — only a value that had to come from the
 *    API proves the two halves are talking. The vendor's own page is used
 *    rather than the landing page because the landing page shows a curated
 *    subset, and a vendor dropping out of it is not an outage.
 *
 * Step 2 is advisory when the API answers but simply has no published vendor
 * yet (VEN-598): `staging`/`production` seed no vendor of their own — "real
 * sign-ups only" — so the very first release onto a freshly-migrated
 * environment, or any environment reset from empty, cannot have one before a
 * real vendor publishes. That is not a broken release; the release itself is
 * what `/ready` already proved. An **HTTP failure** from `/vendors` is still a
 * hard failure — only a healthy, empty answer is advisory — and step 3 only
 * runs once step 2 actually found a vendor to check.
 */
export async function runSmokeCheck(options: SmokeOptions): Promise<SmokeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? DEFAULTS.deadlineMs;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;
  const retryDelayMs = options.retryDelayMs ?? DEFAULTS.retryDelayMs;

  const api = options.apiUrl.replace(/\/+$/, '');
  const web = options.webUrl.replace(/\/+$/, '');
  const startedAt = now();
  const checks: SmokeResult['checks'] = [];

  /** Retries while a deploy is still building, rather than failing early. */
  async function untilDeadline<T>(
    attempt: () => Promise<{ ok: boolean; value?: T; detail: string }>,
  ): Promise<{ ok: boolean; value?: T; detail: string }> {
    let last: { ok: boolean; value?: T; detail: string };

    do {
      last = await attempt();

      if (last.ok) {
        return last;
      }

      if (now() - startedAt + retryDelayMs >= deadlineMs) {
        break;
      }

      await sleepImpl(retryDelayMs);
    } while (now() - startedAt < deadlineMs);

    return last;
  }

  const ready = await untilDeadline(async () => {
    const response = await fetchWithTimeout(`${api}/ready`, requestTimeoutMs, fetchImpl);

    if (!response.ok) {
      // A database role row-level security does not bind is named in `reason`,
      // which the 120-character cut below would lose behind the other fields (VEN-671).
      const reason = /"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(response.body)?.[1];

      return {
        ok: false,
        detail: `HTTP ${response.status} — ${reason ?? response.body.slice(0, 120)}`,
      };
    }

    // The body is what proves the dependencies answered, not the status.
    const isReady = /"status"\s*:\s*"ready"/.test(response.body);

    if (!isReady) {
      return { ok: false, detail: response.body.slice(0, 160) };
    }

    if (!options.expectCommit) {
      return { ok: true, detail: 'database up' };
    }

    // A short SHA on either side still has to match, so compare on the prefix.
    const serving = /"commit"\s*:\s*"([^"]+)"/.exec(response.body)?.[1] ?? null;
    const shortest = Math.min(serving?.length ?? 0, options.expectCommit.length);
    const matches =
      serving !== null &&
      shortest > 0 &&
      serving.slice(0, shortest) === options.expectCommit.slice(0, shortest);

    return {
      ok: matches,
      detail: matches
        ? `database up, serving ${options.expectCommit.slice(0, 7)}`
        : `ready, but serving ${serving ? serving.slice(0, 7) : 'an unknown commit'} rather than ${options.expectCommit.slice(0, 7)}`,
    };
  });
  checks.push({ name: 'API /ready', ok: ready.ok, detail: ready.detail });

  if (!ready.ok) {
    return { ok: false, checks };
  }

  const vendor = await untilDeadline<{ name: string; slug: string } | null>(async () => {
    const response = await fetchWithTimeout(
      `${api}${API_VERSION_PREFIX}/vendors?pageSize=1`,
      requestTimeoutMs,
      fetchImpl,
    );

    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}` };
    }

    const name = jsonString(/"businessName"\s*:\s*("(?:[^"\\]|\\.)+")/.exec(response.body)?.[1]);
    const slug = /"slug"\s*:\s*"([^"]+)"/.exec(response.body)?.[1];

    if (name && slug) {
      return { ok: true, value: { name, slug }, detail: `read "${name}" from the API` };
    }

    // Advisory only for a genuinely empty list — a fresh environment, not an
    // outage. Anything else that fails to yield a name and slug (a renamed
    // field, a malformed body) is a real break and must still fail hard, or
    // this stage would silently stop checking forever.
    if (/"items"\s*:\s*\[\s*\]/.test(response.body)) {
      return {
        ok: true,
        value: null,
        detail: 'no published vendor yet — advisory on a fresh environment with no real sign-ups',
      };
    }

    return { ok: false, detail: 'no readable vendor name/slug in a non-empty response' };
  });
  checks.push({ name: 'API has real data', ok: vendor.ok, detail: vendor.detail });

  if (!vendor.ok) {
    return { ok: false, checks };
  }

  if (!vendor.value) {
    // Both checks pushed so far are `ok` — either would have returned early
    // above otherwise — so there is nothing left to fail on.
    return { ok: true, checks };
  }

  const { name, slug } = vendor.value;
  const profileUrl = `${web}/vendors/${slug}`;

  const front = await untilDeadline(async () => {
    const response = await fetchWithTimeout(profileUrl, requestTimeoutMs, fetchImpl);

    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status} — ${response.body.slice(0, 120)}` };
    }

    /*
     * The whole point of asserting content: a public page returns 200 during
     * an API outage by design, so only a value that had to come from the API
     * shows the two halves are actually talking.
     */
    const rendered = decodeEntities(response.body).includes(name);

    return {
      ok: rendered,
      detail: rendered
        ? `${profileUrl} rendered "${name}"`
        : `200, but "${name}" is absent — the page rendered without its data`,
    };
  });
  checks.push({ name: 'Web renders real data', ok: front.ok, detail: front.detail });

  return { ok: checks.every((check) => check.ok), checks };
}

/** A captured JSON string literal, quotes included, as the value it encodes. */
function jsonString(literal: string | undefined): string | undefined {
  if (literal === undefined) return undefined;

  try {
    return JSON.parse(literal) as string;
  } catch {
    return undefined;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * HTML text as the reader sees it. React escapes `&`, `<`, `>`, `"` and `'` in
 * rendered text (VEN-656: "Kessler & Co." arrives as `Kessler &amp; Co.`), so
 * a name read from the API's JSON is only comparable after decoding. One pass,
 * so `&amp;lt;` stays the literal text `&lt;`.
 */
function decodeEntities(html: string): string {
  return html.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (entity, hex, dec, named) => {
    if (hex !== undefined || dec !== undefined) {
      const code = Number.parseInt(hex ?? dec, hex !== undefined ? 16 : 10);

      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }

    return NAMED_ENTITIES[(named as string).toLowerCase()] ?? entity;
  });
}
