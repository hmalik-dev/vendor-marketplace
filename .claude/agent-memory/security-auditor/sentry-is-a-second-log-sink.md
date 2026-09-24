---
name: sentry-is-a-second-log-sink
description: Sentry is the second egress for an error; scrubErrorEvent is the only gate — request.url is now path-only, and what escapes it is a name the header list misses or a shape no regex knows
metadata:
  type: project
---

VEN-397 gave both apps a second egress for an error object. Audit every new
capture against **both** sinks, not just pino.

**Why:** `apps/api/src/plugins/error-handler.ts` calls `report(error, …)` beside
each `request.log.error({ err })`. The log line is stripped by
`apps/api/src/lib/log-error-serializer.ts`; the Sentry path is closed too —
`sentryErrorReporter.capture` wraps the error in `redactErrorValues` before
`captureException`, so bound query values never reach `exception.values` or a
`cause` walked by `linkedErrorsIntegration`. **A `Sentry.*` call made directly,
outside `ErrorReporter`, is the regression.**

**Closed (VEN-522, verified 2026-09-21):** `scrubErrorEvent` now cuts
`request.url` to its path (`pathOf`), drops `request.env`, withholds a value
under a token/secret/ticket/pass/auth-named or whole-query key, and redacts
IPv4/IPv6 and `/invites?|tickets?/<segment>` in every string. The SSE stream
ticket was probed through `request.url`, breadcrumb and span `url.full`,
`http.query`, `url.query`, `transaction`, `exception.values[].value` and nested
`extra` — no surviving path.

**How to apply — what the scrubber still cannot do, in order of reach:**

- **A header is caught by _name_ or not at all when its value is not
  address-shaped.** `^x-vercel-ip-` covers Vercel; `cf-ipcountry` and `cf-ray`
  are not listed, and the API sits behind Cloudflare (`cf-connecting-ip` is).
- `IPV6`'s captured boundary `[^\w:]` cannot match a preceding colon, so
  `remoteAddress:2001:db8::1` passes whole. `[^\w]` fixes it and still leaves
  `12:30:45` and `file.ts:12:30` alone.
- `CREDENTIAL_PATH` redacts one segment: `/invites/accept/<tok>` keeps `<tok>`.
- An **object** at `depth >= MAX_DEPTH` is returned whole — strings inside it are
  never scanned. `normalizeDepth: 3` collapses that first in practice.
- `sdkProcessingMetadata.normalizedRequest.headers` holds the raw cookie and
  `authorization` (`WITHHELD_KEY`'s `auth(?!or)` excludes the word). Harmless
  only because `@sentry/core@10.74.0` `envelope.js:44` deletes the field.
- **The only hang in `beforeSend` is `EMAIL`**, quadratic: 5.8 s on a 120 KB
  dotted-digit string, 0.94 s on 50 KB of letters, and `extra`/span strings are
  not capped by `maxValueLength`. The IP and path regexes cost <20 ms there.

Background captures (VEN-608, audited clean): a lost email or unsent operator
alert is reported as `new Error(\`...: ${type|kind}\`)` with empty context —
server-written type/kind only; recipient, summary and details stay out on
purpose. A capture that interpolates any of those is the regression.

Settled, do not re-report: `beforeSendTransaction` is registered beside
`beforeSend` in both apps; `sendDefaultPii: false` everywhere; `user` is reduced
to a bare id.
