# Security auditor memory — vendor-marketplace

## Environment, config and secrets

- [`DEPLOY_ENV` is the only tier signal](deploy-env-is-the-only-tier-signal.md) — sink, live-key guard, Sentry env fail closed; Neon Auth mail is outside the sink
- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps pass `baseline`; `local` bricks the Vercel build
- [The deployment gate fails open on an unnamed host](deployment-gate-detects-by-marker-and-fails-open.md) — no marker + no `NODE_ENV=production` = laptop value
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a hook blocks credential-shaped literals in bash
- [.env.lane mode is not repaired on rewrite](lane-env-file-mode-not-repaired.md) — `mode` applies only on create
- [TLS headers key on the build-time origin](tls-headers-key-on-build-time-origin.md) — `headers()` baked at build; VEN-606 bakes `SITE_ORIGIN`
- [A new secret header has three registries](new-secret-header-has-three-registries.md) — pino `redact`, Sentry `CREDENTIAL_HEADER`, a self-failing placeholder
- [The Resend secret's absence is refusal](resend-webhook-absence-is-refusal.md) — optional everywhere is correct
- [CSP `'unsafe-inline'` is a recorded trade-off](csp-unsafe-inline-is-a-recorded-tradeoff.md) — never add script-src hosts
- [Deploy pipeline secret handling](deploy-pipeline-secret-handling.md) — child env/argv redacted; tier fallback; VEN-634 dispatch gate runs inside the sha it gates
- [CI e2e artifacts are public](ci-e2e-artifacts-are-public.md) — traces carry cookies, stripe-listen.log carries whsec
- [`.auth/*.json` was outside the secret scan](auth-storage-state-is-outside-the-secret-scan.md) — `FORBIDDEN_PATHS` covers the path only
- [A storage branch per lane, CI run and PR](neon-storage-branch-per-runner.md) — `NEON_API_KEY` is production-capable; keep it step-scoped
- [The no-trace guard fights the history scan](no-trace-guard-vs-history-scan.md) — `gitleaks git` reads every commit; fragments must split the needle
- [Backup integrity is not authenticity](backup-integrity-is-not-authenticity.md) — a bucket-token holder forges a dump restored as superuser

## Auth, identity and tenancy

- [Neon Auth cutover boundaries](neon-auth-cutover-boundaries.md) — role double-narrowed; VEN-642, VEN-635 clean
- [The Terms gate is a five-state session](terms-gate-is-a-five-state-session.md) — `request.auth` null for a gated account; `requireAuthSubject` the exception
- [The server session cache's key is the whole gate](server-session-cache-key-is-the-cookie.md) — a hit skips signature/revocation; VEN-628 lag; VEN-717 refused-token re-mint clean
- [`getCurrentUser`'s cache() is safe; route dynamism is borrowed](identity-read-is-cached-and-route-dynamism-is-inherited.md) — `/` has no `force-dynamic`
- [Email is a label, the auth id is the key](email-uniqueness-is-partial-nothing-joins-by-email.md) — partial `lower(email)` index + lowercase CHECK (VEN-649)
- [Closing an account releases its address, scrubs the row, deletes uploads](closed-account-address-is-released.md) — VEN-614/672/687 scrubs (0089/0093/0097) clean
- [The sign-up role is recorded server-side, first write wins](signup-role-is-confirmed-not-narrowed.md) — VEN-662: a squatter fixes the victim's role (Low)
- [Route handlers do not inherit layout gates](route-handlers-do-not-inherit-layout-gates.md) — `/admin/vendors/export` authorizes itself; [layout gates run beside the page](layout-gates-run-concurrently-with-the-page.md) (VEN-715)
- [Validation runs before preHandler guards](schema-validation-runs-before-prehandler-guards.md) — `requireAuthBeforeValidation`; two enum routes left low
- [The event stream's auth is hand-rolled on purpose](stream-route-auth-is-hand-rolled.md) — `requireAuth` breaks it; keep the inline ban check
- [safeReturnPath is FIXED](validate-before-normalize-return-path.md) — parse-then-reserialise; VEN-653 exemption clean
- [`x-orla-request-path` is forgeable only where nothing reads it](middleware-request-path-header-trust.md) — matcher skips dotted paths
- [The role bounce loop is FIXED](role-bounce-self-loop-admin-bookings.md) — `roleCanReach` is a hint, never a gate
- [Every `FORBIDDEN` is read as a suspension](every-forbidden-is-read-as-a-suspension.md) — `useApi` keys on `ACCOUNT_SUSPENDED`; the server twin does not

## Vendor visibility, moderation and PII

- [`VENDOR_VISIBLE` is the only public vendor gate](vendor-visible-is-the-only-public-vendor-gate.md) — checkout has no vendor predicate
- [Moderation levers are undoable by their subject](moderation-levers-are-undoable-by-their-subject.md) — `moderation_hold`; both paths closed
- [Customer PII has two disclosure gates](customer-pii-has-two-disclosure-gates.md) — profile relationship vs per-request status
- [Slug aliases reserve slugs for ever](vendor-slug-aliases-reserve-slugs.md) — VEN-648: uncapped aliases can 409 a name's slug attempts
- [The public vendor card is the widest anonymous projection](public-vendor-card-is-the-widest-anonymous-projection.md) — the DAO's literal decides
- [The public price filter is a pricing oracle](search-price-filter-is-a-pricing-oracle.md) — any-package EXISTS was binary-searchable
- [`/places` replaced an inventory oracle](places-endpoint-replaced-an-inventory-oracle.md) — no `ESCAPE` is correct on Postgres
- [The data-rights export is hand-enumerated](data-rights-export-is-hand-enumerated.md) — a new `users` PII column misses the DSAR file
- [Response schemas are a second write boundary](response-schemas-are-a-second-write-boundary.md) — widen a write schema alone and a reader 500s
- [`'use client'` publishes a pane's props](client-component-props-are-public-html.md) — RSC payload is public
- [JSON-LD is the only raw-HTML sink in web](json-ld-is-the-only-raw-html-sink.md) — `serialiseJsonLd` mandatory
- [`canBook` is chrome, not a gate](canbook-is-chrome-not-a-gate.md) — three server checks refuse a vendor
- [Vendor selection writes are transaction-only](vendor-selection-writes-are-transaction-only.md) — no self-transacting
- [The `updatedAt` precondition is not a gate](edit-version-precondition-is-not-a-gate.md) — explicit `null` coerces to the epoch
- [The vendor agreement gate has four definitions](vendor-agreement-gate-has-four-definitions.md) — payout takes any version; EXISTS needs `vendor_profiles` unaliased; VEN-708/730/740 bumps clean
- [Vendor invite gate checks before the row it creates](vendor-invite-gate-checks-before-the-row-it-creates.md) — an application row diverts `/accept-terms` for ever

## Money, bookings and background work

- [availability.status literals are load-bearing](availability-status-literals-are-load-bearing.md) — guards compare to `'booked'`; `syncHeldDate` needs `lockHeldDate`
- [Availability floors are one day wider than UTC](availability-date-floors-are-universally-past.md) — `booked` predicates protect history
- [Booking reads gate on two separate paths](booking-reads-gate-on-two-separate-paths.md) — `reconcileBooking` leaked the fee split until #387
- [The reply-window cap lives in five places](reply-deadline-cap-must-match-accept-guard.md) — `expires_at` has two meanings
- [Refund idempotency keys carry the already-refunded total](refund-idempotency-key-is-parameter-sensitive.md) — dedup only while racers read the same state
- [A refund with no durable record can happen twice](refund-before-row-move-can-double-refund.md) — past 24h a retry debits again
- [API session timeouts vs Stripe-in-transaction](api-session-timeouts-vs-stripe-in-transaction.md) — VEN-607: 55P03 and idle kills after Stripe calls
- [D31's proportional split is now our arithmetic](refund-proportionality-is-now-ours-to-state.md) — pre-release cancel states no retained half
- [The payout sweep is a second money mover](payout-sweep-is-a-second-money-mover.md) — it locks rows cancel/dispute do not
- [`payoutOwedClauses` is shared with the sweep](payout-owed-clauses-is-shared-with-the-sweep.md) — widening the read widens the transfer claim
- [Settlement is a fourth money projection](settlement-is-a-third-money-projection.md) — no ownership predicate; VEN-725 statement DAO vendorId filter fails open
- [Backup withholding is a fifth money projection](backup-withholding-is-a-fifth-money-projection.md) — VEN-723; post-release reversal ignores `backup_withheld_cents`
- [Legacy destination rows are guarded twice](legacy-destination-rows-guarded-in-one-place.md) — VEN-658 zero-transfer release matches it; deploy window open
- [Launch switches gate new intents, not open ones](launch-switches-gate-new-intents-not-open-ones.md) — an issued client secret survives
- [Idempotency guards orphan their side effects](idempotency-guards-orphan-side-effects.md) — `ON CONFLICT DO NOTHING` fronts non-tx writes
- [The background queue carries no session](background-work-queue-carries-no-session.md) — never close over `request.auth` or a `tx`
- [`metadata.env` is the cross-deployment filter](env-tag-is-the-cross-deployment-filter.md) — one shared Stripe test account; filter order load-bearing; VEN-644/645 notes
- [The e2e fixture now calls Stripe for real](e2e-fixture-creates-real-stripe-accounts.md) — one `sk_test_` check keeps a live key out
- [`stripe_onboarded` entails an account id](stripe-onboarded-entails-account-id.md) — `acct_` format check refused (product)

## Account closure, bans and support

- [Closure refuses only the customer side](closure-refuses-only-the-customer-side.md) — a vendor closure refunds every future booking (D39 supersedes [the old unwind note](account-unwind-full-refund-is-the-ban-argument.md))
- [Ban and closure are resumable endpoints now](unwind-resume-is-a-repeatable-endpoint.md) — pending gate never clears on a legacy booking; VEN-693 unban halt clean
- [An unwind spares a request with a booking behind it](unwind-decline-spares-requests-with-a-booking.md) — closes a post-unban double-book
- [`cancelled_by` names the actor, not the suspended side](cancelled-by-does-not-say-which-side.md) — copy false to an unbanned customer
- [The acceptance record is undeletable PII](legal-acceptance-record-is-undeletable-pii.md) — soft delete never fires the trigger
- [The support form is a public route that moves money](support-report-is-a-public-route-that-moves-money.md) — anonymous `bookingId` freezes a payout
- [A public endpoint mails the caller's own text anywhere](public-mail-endpoint-echoes-to-any-address.md) — echo gated on `signedIn`
- [`support_cases` is the first durable copy of a complaint](support-cases-is-the-first-durable-copy-of-a-complaint.md) — refund gate is a deny-list on `dispute.status`
- [The staff read of a private thread is one `support_cases` row](conversation-read-grant-is-an-open-case-row.md) — nothing constrains `subject_type`
- [The admin action log is trigger-immutable](admin-action-log-is-trigger-immutable.md) — cascade exception needs a hard delete
- [Messaging tenancy is two statements](messaging-tenancy-is-two-statements.md) — preview subquery needs the outer table unaliased

## Input, output and logging

- [URL params are validated in the nuqs hook](url-params-validated-in-the-nuqs-hook.md) — the hook is the boundary
- [Query-keyed literal maps need `Object.hasOwn`](query-keyed-literal-maps-need-hasown.md) — `?saved=__proto__`
- [Image key columns are client-supplied](image-key-columns-are-client-supplied.md) — `/_next/image` patterns derive from the storage env var
- [Every image-ref bypass is FIXED; the host is not](image-ref-scheme-allowlist-is-whitespace-bypassable.md) — any https host still accepted
- [The image pipeline is one process-wide 2-slot queue](image-pipeline-is-one-process-wide-queue.md) — unbounded FIFO of 12 MB buffers
- [NUL/22021 and 22001 fail a statement on demand](free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand.md) — `freeText()` safe; bare `z.string()` not
- [Webhook payload text bypasses the bidi strip](provider-payload-text-bypasses-the-bidi-strip.md) — hand-`safeParse` is invisible to the guard
- [Reviews: profanity floor, eligibility and tombstones](review-profanity-filter-is-a-hard-reject-floor.md) — a review can outlive a cancel
- [The `err` serialiser is the log sink](err-serializer-is-the-log-sink.md) — fields beside `err` are verbatim; log an opaque id
- [Sentry is a second log sink](sentry-is-a-second-log-sink.md) — `request.url` path-only; VEN-674 ReDoS notes
- [Webhook error objects carry the redacted header](webhook-error-objects-carry-the-redacted-header.md) — `log.warn({err})` re-emits the signature
- [Log redaction covers the query, not the path](log-redaction-covers-query-not-path.md) — a path-segment credential logs whole
- [Two failure-reason columns store the gateway's raw message](failure-reason-columns-rest-on-a-status-only-gateway.md) — status-only gateway is the guard
- [The error handler's 4xx passthrough is FIXED](error-handler-4xx-passthrough-leaks-sdk-messages.md) — only `FST_` errors speak
- [`violatesConstraint` is FIXED](violates-constraint-matches-bound-parameters.md) — SQLSTATE + `constraint_name`
- [A browser parse failure is reader-visible copy](client-parse-failures-are-shown-verbatim.md) — a landed transfer reads as failed
- [The 500 screen hides chrome, it does not unmount it](error-screen-chrome-is-hidden-not-unmounted.md) — header hydrates hidden
- [Legal claims rest on two under-matching scans](no-cookie-consent-claim-rests-on-a-source-scan.md) — `TRACKERS` is a vendor list
- [Rate limiting: hop-0 proxy, pre-auth hook, per-account keys](rate-limit-key-is-the-proxy-not-the-caller.md) — `rateLimitRan` can disable a route's limit
- [`request.ip` is one hop, never IP-validated](request-ip-is-one-hop-trusted-not-validated.md) — unbounded text vs `varchar(45)`
- [`/ready` is unthrottled by design](ready-probe-is-unthrottled-and-now-reads-a-file.md) — presence booleans and RLS posture accepted
- [Operator alert dedupe is attacker-armable](operator-alert-dedupe-is-attacker-armable.md) — a shed 429 costs a DB write
- [The daily send cap's closure is sticky](email-send-cap-closure-is-sticky.md) — blocks step-up codes till midnight; VEN-688 recorded cap + refusal marker clean; [VEN-680 codes](self-closure-step-up-codes-are-essential-mail.md)
- [Auth proxy parser differential](auth-proxy-parser-differential.md) — body-derived key fails closed; VEN-630/718 per-caller budgets are IP-rotatable to a 10x ceiling
- [Next's fetch cache key includes headers](next-fetch-cache-key-includes-headers.md) — a per-call header on a `revalidate` read defeats the Data Cache; VEN-690 request id

## Data layer, seeds and tooling

- [Fabricating seeds share one declared-branch guard](fabricating-seeds-share-one-declared-branch-guard.md) — `assertSafeTarget` trusts `.neon`/`NEON_BRANCH`
- [The contention harness issues server DDL](contention-harness-issues-server-ddl.md) — accepted, fresh-UUID names
- [The contention gate is a path pattern](contention-gate-is-a-path-pattern.md) — misses `modules/payments/payments.*`
- [The categories cascade is single-edged, for now](categories-cascade-is-single-edged.md) — a second cascading FK is silent loss
- [The `/search` retired-category 308 rests on three invariants](search-retired-category-redirect.md) — prefix, `Object.hasOwn`, no key successor
- [launch:check bearer hosts are fixed](launch-check-bearer-hosts-are-fixed.md) — reopen if `bearer()` meets an env URL
- [Admin booking detail, requests funnel, list search](admin-booking-detail-and-requests-reads.md) — PASS; VEN-743 `q` needs joins in every scan
- [Admin vendor detail is a gated aggregate](admin-vendor-detail-is-a-gated-aggregate.md) — notification `body` bypasses the case grant
- [The staging probe spec's guard is the URL, not DEPLOY_ENV](staging-probe-spec-guard.md) — required `STAGING_WEB_URL`
- [Admin category writes](admin-category-writes.md) — PASS; toggle can double-write audit
- [RLS is enabled, never forced](rls-is-enabled-not-forced-owner-bypasses.md) — owner bypasses; a non-owner role reads zero rows
