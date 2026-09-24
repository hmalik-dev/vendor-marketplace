# Security auditor memory — vendor-marketplace

## Environment, config and secrets

- [`DEPLOY_ENV` is the only tier signal](deploy-env-is-the-only-tier-signal.md) — sink, live-key guard, Sentry env fail closed; Neon Auth mail is outside the funnel
- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps pass `baseline`; `local` bricks the Vercel build
- [Deployment gate fails open on an unnamed host](deployment-gate-detects-by-marker-and-fails-open.md) — no marker + no prod NODE_ENV = laptop value
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a hook blocks credential-shaped literals on bash lines
- [.env.lane mode is not repaired on rewrite](lane-env-file-mode-not-repaired.md) — `mode` applies only on create
- [TLS headers key on the build-time origin](tls-headers-key-on-build-time-origin.md) — `headers()` baked at build; VEN-606 bakes `SITE_ORIGIN`
- [A new secret header has three registries](new-secret-header-has-three-registries.md) — pino `redact`, Sentry `CREDENTIAL_HEADER`, a self-failing placeholder
- [The Resend secret's absence is refusal](resend-webhook-absence-is-refusal.md) — no route exists without a secret
- [CSP `'unsafe-inline'` is a recorded trade-off](csp-unsafe-inline-is-a-recorded-tradeoff.md) — never add script-src hosts
- [Deploy pipeline secret handling](deploy-pipeline-secret-handling.md) — child env/argv redacted; branch-as-env falls back across tiers; Resend key full-access
- [CI e2e artifacts are public](ci-e2e-artifacts-are-public.md) — traces carry session cookies, stripe-listen.log carries whsec
- [`.auth/*.json` was outside the secret scan](auth-storage-state-is-outside-the-secret-scan.md) — `FORBIDDEN_PATHS` covers the path
- [A storage branch per lane, CI run and PR](neon-storage-branch-per-runner.md) — `NEON_API_KEY` is prod-capable; keep it step-scoped
- [The no-trace guard fights the history scan](no-trace-guard-vs-history-scan.md) — `gitleaks git` reads every commit; fragments must split the needle
- [Backup integrity is not authenticity](backup-integrity-is-not-authenticity.md) — a bucket-token holder forges a dump restored as superuser

## Auth, identity and tenancy

- [Neon Auth cutover boundaries](neon-auth-cutover-boundaries.md) — verification sound, role double-narrowed; VEN-642/635 clean
- [The Terms gate is a five-state session](terms-gate-is-a-five-state-session.md) — `request.auth` null when gated; `requireAuthSubject` the exception
- [Server session cache key is the whole gate](server-session-cache-key-is-the-cookie.md) — a hit skips signature/revocation; VEN-628 outruns other caches
- [`getCurrentUser`'s cache() is safe](identity-read-is-cached-and-route-dynamism-is-inherited.md) — `/` renders a booking amount with no `force-dynamic`
- [Email is a label, the auth id is the key](email-uniqueness-is-partial-nothing-joins-by-email.md) — partial `lower(email)` index; nothing resolves by email
- [Closing an account releases its address](closed-account-address-is-released.md) — VEN-614/672 scrubs clean; invites keep the address
- [Sign-up role recorded server-side, first write wins](signup-role-is-confirmed-not-narrowed.md) — VEN-662: a squatter fixes the victim's role (Low)
- [Route handlers do not inherit layout gates](route-handlers-do-not-inherit-layout-gates.md) — `/admin/vendors/export` authorizes itself
- [Validation runs before preHandler guards](schema-validation-runs-before-prehandler-guards.md) — fix is `requireAuthBeforeValidation`
- [Event stream auth is hand-rolled on purpose](stream-route-auth-is-hand-rolled.md) — no `requireAuth`; one EventSource per hook call vs a 5-stream cap (VEN-706)
- [safeReturnPath is FIXED](validate-before-normalize-return-path.md) — parse-then-reserialise; VEN-653 loop exemption clean
- [`x-orla-request-path` forgeable only where unread](middleware-request-path-header-trust.md) — matcher skips dotted paths
- [Role bounce loop is FIXED](role-bounce-self-loop-admin-bookings.md) — `roleCanReach` is a hint, never a gate
- [Every `FORBIDDEN` is read as a suspension](every-forbidden-is-read-as-a-suspension.md) — `useApi` keys on `ACCOUNT_SUSPENDED`; server twin reads any 403
- [Auth proxy parser differential](auth-proxy-parser-differential.md) — body-derived rate key fails closed; no retry on credential refusal; VEN-677/685 notes

## Vendor visibility, moderation and PII

- [`VENDOR_VISIBLE` is the only public vendor gate](vendor-visible-is-the-only-public-vendor-gate.md) — checkout has no vendor predicate
- [Moderation levers are undoable by their subject](moderation-levers-are-undoable-by-their-subject.md) — `moderation_hold` closed both paths
- [Customer PII has two disclosure gates](customer-pii-has-two-disclosure-gates.md) — profile relationship vs per-request status
- [Slug aliases reserve slugs for ever](vendor-slug-aliases-reserve-slugs.md) — uncapped aliases can 409 a name's 50 attempts
- [Public vendor card is the widest anonymous projection](public-vendor-card-is-the-widest-anonymous-projection.md) — the DAO literal decides
- [Public price filter is a pricing oracle](search-price-filter-is-a-pricing-oracle.md) — MIN exposes only the printed price
- [`/places` replaced an inventory oracle](places-endpoint-replaced-an-inventory-oracle.md) — missing `ESCAPE` is correct on Postgres
- [Data-rights export is hand-enumerated](data-rights-export-is-hand-enumerated.md) — new `users` PII misses the DSAR file
- [Response schemas are a second write boundary](response-schemas-are-a-second-write-boundary.md) — a widened write schema 500s others' pages
- [`'use client'` publishes a pane's props](client-component-props-are-public-html.md) — RSC-payload lesson
- [JSON-LD is the only raw-HTML sink](json-ld-is-the-only-raw-html-sink.md) — `serialiseJsonLd` mandatory
- [`canBook` is chrome, not a gate](canbook-is-chrome-not-a-gate.md) — three server checks refuse a vendor
- [Vendor selection writes are transaction-only](vendor-selection-writes-are-transaction-only.md) — replace* no longer self-transact
- [The `updatedAt` precondition is not a gate](edit-version-precondition-is-not-a-gate.md) — explicit `null` coerces to the epoch
- [Vendor agreement gate has four definitions](vendor-agreement-gate-has-four-definitions.md) — payout takes any version; EXISTS needs unaliased table
- [Vendor invite gate checks before its row](vendor-invite-gate-checks-before-the-row-it-creates.md) — VEN-512: a GET writes an application row

## Money, bookings and background work

- [availability.status literals are load-bearing](availability-status-literals-are-load-bearing.md) — `syncHeldDate` needs `lockHeldDate`
- [Availability floors are one day wider than UTC](availability-date-floors-are-universally-past.md) — `booked` predicates protect history
- [Booking reads gate on two paths](booking-reads-gate-on-two-separate-paths.md) — `reconcileBooking` leaked the split until #387
- [Reply-window cap lives in five places](reply-deadline-cap-must-match-accept-guard.md) — `expires_at` has two meanings
- [Refund idempotency keys carry the refunded total](refund-idempotency-key-is-parameter-sensitive.md) — dedup holds only on same Stripe state
- [A refund with no durable record can happen twice](refund-before-row-move-can-double-refund.md) — past 24h a retry debits again
- [API session timeouts vs Stripe-in-transaction](api-session-timeouts-vs-stripe-in-transaction.md) — VEN-607 55P03 / idle-kill gaps
- [D31's proportional split is our arithmetic](refund-proportionality-is-now-ours-to-state.md) — pre-release cancel path
- [Payout sweep is a second money mover](payout-sweep-is-a-second-money-mover.md) — its row lock is not shared
- [`payoutOwedClauses` is shared with the sweep](payout-owed-clauses-is-shared-with-the-sweep.md) — widening a read widens the claim
- [Settlement is a fourth money projection](settlement-is-a-third-money-projection.md) — `findSettlements` has no ownership predicate
- [Legacy destination rows guarded twice](legacy-destination-rows-guarded-in-one-place.md) — deploy window is not
- [Launch switches gate new intents only](launch-switches-gate-new-intents-not-open-ones.md) — an issued client secret survives
- [Idempotency guards orphan side effects](idempotency-guards-orphan-side-effects.md) — `ON CONFLICT DO NOTHING` fronts non-tx writes
- [Background queue carries no session](background-work-queue-carries-no-session.md) — re-derive recipient; never close over auth or tx
- [`metadata.env` is the cross-deployment filter](env-tag-is-the-cross-deployment-filter.md) — shared test account; filter order load-bearing
- [E2E fixture calls Stripe for real](e2e-fixture-creates-real-stripe-accounts.md) — one `sk_test_` check keeps live keys out
- [`stripe_onboarded` entails an account id](stripe-onboarded-entails-account-id.md) — `acct_` format check refused (product)

## Account closure, bans and support

- [Closure refuses only the customer side](closure-refuses-only-the-customer-side.md) — vendor closure refunds all future bookings
- [Unwind's full refund is the ban's argument](account-unwind-full-refund-is-the-ban-argument.md) — superseded by D39
- [Ban and closure are resumable](unwind-resume-is-a-repeatable-endpoint.md) — pending gate never clears on legacy bookings
- [An unwind spares a request with a booking](unwind-decline-spares-requests-with-a-booking.md) — closes a double-booking window
- [`cancelled_by` names the actor](cancelled-by-does-not-say-which-side.md) — "other account suspended" can be false
- [Acceptance record is undeletable PII](legal-acceptance-record-is-undeletable-pii.md) — soft delete never fires the trigger
- [Support form is a public route that moves money](support-report-is-a-public-route-that-moves-money.md) — anon `bookingId` freezes a payout
- [A public endpoint mails caller text anywhere](public-mail-endpoint-echoes-to-any-address.md) — echo gated on `signedIn`
- [`support_cases` is the first durable complaint copy](support-cases-is-the-first-durable-copy-of-a-complaint.md) — deny-list on `dispute.status`
- [Staff read of a private thread is one case row](conversation-read-grant-is-an-open-case-row.md) — no FK/CHECK on `subject_type`
- [Admin action log is trigger-immutable](admin-action-log-is-trigger-immutable.md) — cascade exception needs a hard delete
- [Messaging tenancy is two statements](messaging-tenancy-is-two-statements.md) — preview subquery needs unaliased outer table

## Input, output and logging

- [URL params are validated in the nuqs hook](url-params-validated-in-the-nuqs-hook.md) — the hook is the boundary, not the screen
- [Query-keyed literal maps need `Object.hasOwn`](query-keyed-literal-maps-need-hasown.md) — `?saved=__proto__` indexes `Object.prototype`; VEN-703 settings banner
- [Image key columns are client-supplied](image-key-columns-are-client-supplied.md) — probe with the bucket-path base; `/_next/image`'s remote patterns are an anonymous fetcher and must derive from the storage env var; VEN-618 owner segment is a digest, raw id still accepted
- [Every image-ref bypass is FIXED; the host is not](image-ref-scheme-allowlist-is-whitespace-bypassable.md) — `https://evil.example/x.png` was never closed
- [The image pipeline is one process-wide 2-slot queue](image-pipeline-is-one-process-wide-queue.md) — VEN-464: hand-off is sound, the unbounded FIFO of 12 MB buffers is the ceiling; WebP input audited clean (VEN-618)
- [NUL/22021 and 22001 fail a statement on demand](free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand.md) — `freeText()` refuses NUL now (VEN-689 search params clean); a bare `z.string()` still doesn't
- [Webhook payload text bypasses the bidi strip](provider-payload-text-bypasses-the-bidi-strip.md) — a hand-`safeParse`d schema is invisible to the free-text guard
- [Reviews: profanity floor, eligibility and tombstones](review-profanity-filter-is-a-hard-reject-floor.md) — tombstone finality rests on read order; a review can outlive a cancel
- [The `err` serialiser is the log sink](err-serializer-is-the-log-sink.md) — pino's three doors and bound params closed; the fields _beside_ `err` are verbatim, and the convention is an opaque id
- [Sentry is a second log sink](sentry-is-a-second-log-sink.md) — VEN-522 made `request.url` path-only; VEN-674 ReDoS notes (boundary-captured EMAIL leaks chains, QUERY_VALUE `?`-run)
- [Webhook error objects carry the redacted header](webhook-error-objects-carry-the-redacted-header.md) — `log.warn({err})` re-emits `stripe-signature` and the raw body
- [Log redaction covers the query, not the path](log-redaction-covers-query-not-path.md) — a credential in a path segment is logged whole
- [Two failure-reason columns store the gateway's raw message](failure-reason-columns-rest-on-a-status-only-gateway.md) — admins read one; the only guard is `Resend refused the send (status)` carrying no address
- [The error handler's 4xx passthrough is FIXED](error-handler-4xx-passthrough-leaks-sdk-messages.md) — only `FST_` errors speak now
- [`violatesConstraint` is FIXED](violates-constraint-matches-bound-parameters.md) — SQLSTATE + `constraint_name` only
- [A browser parse failure is reader-visible copy](client-parse-failures-are-shown-verbatim.md) — a landed transfer reports as failed
- [The 500 screen hides chrome, it does not unmount it](error-screen-chrome-is-hidden-not-unmounted.md) — the header hydrates behind `display:none`
- [Legal claims rest on two under-matching scans](no-cookie-consent-claim-rests-on-a-source-scan.md) — `TRACKERS` is a vendor list; VEN-596 closed the prose denials; "not tied to your account" rests on `analytics-scrub.ts`
- [Rate limiting: hop-0 proxy, pre-auth hook, per-account keys](rate-limit-key-is-the-proxy-not-the-caller.md) — one `rateLimitRan` symbol can silently disable a route's own limit; VEN-649's once-per-process tier-key report is spendable by any probe
- [`request.ip` is one hop, never IP-validated](request-ip-is-one-hop-trusted-not-validated.md) — unbounded text against `varchar(45)` when persisted as evidence
- [`/ready` is unthrottled by design](ready-probe-is-unthrottled-and-now-reads-a-file.md) — VEN-495 sync read on the unlimited route; presence booleans (VEN-632) and RLS posture (VEN-671) accepted; the owner check must follow role membership
- [Operator alert dedupe is attacker-armable](operator-alert-dedupe-is-attacker-armable.md) — a shed 429 costs a DB write; the email cap drops on a DB outage
- [The daily send cap's closure is sticky](email-send-cap-closure-is-sticky.md) — VEN-661: a closed day blocks step-up codes till UTC midnight; raising the cap does not reopen it; [VEN-680 self-closure codes spend the essential headroom](self-closure-step-up-codes-are-essential-mail.md)

## Data layer, seeds and tooling

- [Fabricating seeds share one branch guard](fabricating-seeds-share-one-declared-branch-guard.md) — trusts `.neon`/`NEON_BRANCH`
- [Contention harness issues server DDL](contention-harness-issues-server-ddl.md) — accepted: fresh UUID name
- [Contention gate is a path pattern](contention-gate-is-a-path-pattern.md) — misses `payments.*`
- [Categories cascade is single-edged](categories-cascade-is-single-edged.md) — a second cascading FK is data loss
- [`/search` retired-category 308](search-retired-category-redirect.md) — three invariants
- [launch:check bearer hosts are fixed](launch-check-bearer-hosts-are-fixed.md) — reopen if env-built URL
- [Admin booking detail + requests funnel](admin-booking-detail-and-requests-reads.md) — PASS
- [Admin vendor detail is a gated aggregate](admin-vendor-detail-is-a-gated-aggregate.md) — `body` bypasses the case grant
- [Staging probe spec guard is the URL](staging-probe-spec-guard.md) — required `STAGING_WEB_URL`
- [Admin category writes](admin-category-writes.md) — PASS; toggle can double-write audit row
- [RLS is enabled, never forced](rls-is-enabled-not-forced-owner-bypasses.md) — owner bypasses; non-owner reads zero silently
