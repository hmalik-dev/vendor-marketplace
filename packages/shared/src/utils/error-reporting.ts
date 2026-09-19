/**
 * What both apps send to Sentry, decided once.
 *
 * `@sentry/node` and `@sentry/nextjs` each take a `beforeSend` hook and a pair
 * of sample rates. Written twice, the two would drift the first time one of
 * them learned about a new header, so the rules live here and each app hands
 * the SDK these values. Nothing in this file imports an SDK: the event is typed
 * structurally, which is all a scrubber needs, and it keeps `shared` free of a
 * dependency only two consumers have.
 */

/**
 * Explicit, never the SDK default. Every error is kept — at this volume the
 * error quota is not the constraint, and a sampled-away payment failure is the
 * one nobody hears about. Traces are a small slice: they exist to explain a
 * slow route, not to account for every request.
 */
export const ERROR_REPORTING_SAMPLING = {
  sampleRate: 1,
  tracesSampleRate: 0.05,
} as const;

/**
 * The tags a payment failure carries, which the operator's Sentry alert rule
 * filters on. A payment error is the class of failure where a customer has been
 * charged, or a vendor not paid, and nobody else will notice.
 */
export const PAYMENT_ERROR_TAGS = { area: 'payments', severity: 'critical' } as const;

/**
 * Headers dropped by name: the value authenticates a caller, signs a delivery,
 * or says where they are.
 *
 * The anchored group is matched whole and the rest are substrings, so a header
 * has to be named here exactly or carry one of those words. `proxy-authorization`
 * is spelled out because it matches neither otherwise — the anchors exclude it
 * and it contains none of the substrings — and its `Basic` credential is not a
 * shape `redactString` knows. The forwarding headers are here for a different
 * reason: `sendDefaultPii: false` and the reduction of `user` to a bare id are
 * both undone if the caller's address arrives in a header instead.
 */
const CREDENTIAL_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-forwarded-for|x-real-ip|forwarded|x-web-tier-key|x-visitor-ip)$|token|secret|signature|session|svix/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** A JWT — the auth provider's session token is one, and so is its `__session` cookie. */
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
/** A bearer credential in free text, whatever its shape. */
const BEARER = /\bBearer\s+[^\s"',]+/gi;
/** Stripe, the auth provider and Resend server keys and signing secrets. */
const PROVIDER_CREDENTIAL = /\b(?:sk|rk|whsec|re)_[A-Za-z0-9_]{8,}/g;

export const REDACTED = '[redacted]';

/** Deeper than any event an SDK builds; a cycle stops here instead of overflowing. */
const MAX_DEPTH = 12;

function redactString(value: string): string {
  return value
    .replace(JWT, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(PROVIDER_CREDENTIAL, REDACTED)
    .replace(EMAIL, REDACTED);
}

function redactDeep(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactDeep(entry, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactDeep(entry, depth + 1)]),
  );
}

/** The part of a Sentry event this hook reads; everything else passes through redacted. */
export interface ReportableEvent {
  user?: { id?: string | number | undefined } | undefined;
  request?:
    | {
        headers?: Record<string, string> | undefined;
        cookies?: unknown;
        data?: unknown;
        query_string?: unknown;
        /** Path *and* query: every SDK builds it from a value that carries both. */
        url?: unknown;
      }
    | undefined;
}

/**
 * `url` with its query and fragment gone.
 *
 * Dropping `query_string` is not enough, and believing otherwise is how the
 * hazard the doc comment below names stayed open: each SDK sets `url` beside
 * `query_string` from a value that already carries the search — `request.url`
 * in Node is path and query, `winterCGRequestToRequestData` copies a whole URL,
 * and the browser's is `location.href`. So the field this hook dropped and the
 * field it kept held the same stream ticket.
 */
function pathOf(url: unknown): unknown {
  return typeof url === 'string' ? redactString(url.replace(/[?#].*$/s, '')) : url;
}

/**
 * The `beforeSend` both apps install.
 *
 * **The user is reduced to an id.** The auth provider's session carries the email, the SDKs
 * attach an IP address and a username when they can, and none of that is needed
 * to find the account — the id is. Then, because a message, a stack frame's
 * local or a breadcrumb can still quote an email or a token no field was meant
 * to hold, every string left in the event goes through the same redaction.
 * Request bodies, cookies and query strings are dropped rather than redacted: a
 * booking form's body is free text, and an SSE stream ticket rides in the query
 * — which is why `url` is cut back to its path rather than kept, since that is
 * where every SDK writes the query a second time.
 */
export function scrubErrorEvent<TEvent extends ReportableEvent>(event: TEvent): TEvent {
  const { user, request, ...rest } = event;
  const scrubbed = redactDeep(rest, 0) as Record<string, unknown>;

  if (user?.id !== undefined) {
    scrubbed.user = { id: String(user.id) };
  }

  if (request !== undefined) {
    const {
      headers,
      cookies: _cookies,
      data: _data,
      query_string: _query,
      url,
      ...other
    } = request;
    const kept = Object.fromEntries(
      Object.entries(headers ?? {}).map(([name, value]) => [
        name,
        // `String(value)`: the type says these are strings, but the value is
        // whatever the SDK built. A non-string here would throw inside
        // `beforeSend`, and Sentry answers a throwing hook by dropping the
        // event — reporting would fail silently rather than loudly.
        CREDENTIAL_HEADER.test(name) ? REDACTED : redactString(String(value)),
      ]),
    );

    scrubbed.request = {
      ...(redactDeep(other, 0) as object),
      ...(url === undefined ? {} : { url: pathOf(url) }),
      headers: kept,
    };
  }

  return scrubbed as TEvent;
}
