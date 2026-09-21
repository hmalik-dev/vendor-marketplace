---
name: sentry-is-a-second-log-sink
description: VEN-397 added Sentry beside pino; the bound-param bypass is now closed (redactErrorValues), but scrubErrorEvent still keeps request.url with its query string
metadata:
  type: project
---

VEN-397 gave both apps a second egress for an error object. Audit every new
capture against **both** sinks, not just pino.

**Why:** `apps/api/src/plugins/error-handler.ts` now calls `report(error, …)`
next to each `request.log.error({ err })`. The log line goes through
`apps/api/src/lib/log-error-serializer.ts` (`serializeError`, #445) which strips
`DrizzleQueryError`'s `Failed query: … params: <bound values>` from `message`,
`stack` and `params`. **Closed since (verified 2026-09-20):**
`apps/api/src/lib/error-reporting.ts` `sentryErrorReporter.capture` calls
`Sentry.captureException(redactErrorValues(error))`, so the bound values are
stripped before the SDK reads `exception.values[0].value`, the frames, or walks
`cause` via `linkedErrorsIntegration`. Re-check that call, not just pino, when a
new capture site appears — a `Sentry.*` call made directly, outside
`ErrorReporter`, is the regression.

Still open in the event body: `scrubErrorEvent` only knows email / JWT /
`Bearer` / `sk_|rk_|whsec_|re_` shapes, so names, phones, addresses and free text
in anything else the capture carries pass whole — and a stranger can still
choose the moment a failure ships, via the public unauthenticated
`POST /support/messages` plus a caller-chosen `U+0000`
([[free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand]]).

**Second gap, same file:** `packages/shared/src/utils/error-reporting.ts`
deletes `request.cookies`, `.data` and `.query_string` but spreads `url` back.
Verified against `@sentry/core@10.74.0` `utils/request.js` — `url` is the
absolute URL _including_ the search, in both the Node and the WinterCG builders,
and is `location.href` in the browser. So the query-borne SSE stream ticket the
comment names as the reason is retained.

**How to apply:** settled and not to re-report — `beforeSendTransaction` **is**
registered beside `beforeSend` in both apps, so the 5% traces sample is scrubbed;
`redactDeep` redacts strings above `MAX_DEPTH`; `sendDefaultPii: false`
everywhere. `x-forwarded-for` and `proxy-authorization` are **not** in
`CREDENTIAL_HEADER`.
