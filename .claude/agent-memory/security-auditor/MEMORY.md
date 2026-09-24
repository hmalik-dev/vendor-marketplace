# Security auditor memory — vendor-marketplace

## Environment, config and secrets

- [`DEPLOY_ENV` is the only tier signal](deploy-env-is-the-only-tier-signal.md) — sink, live-key guard and Sentry env all fail closed; the sink rests on one gateway funnel, and Neon Auth mail is outside it
- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps must pass `baseline`; `local` bricks the Vercel build
- [The deployment gate fails open on an unnamed host](deployment-gate-detects-by-marker-and-fails-open.md) — no marker + no `NODE_ENV=production` sets the laptop value silently
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a PreToolUse hook blocks credential-shaped literals on any bash line
- [.env.lane mode is not repaired on rewrite](lane-env-file-mode-not-repaired.md) — `mode` applies only on create; nothing asserts 0600
- [TLS headers key on the build-time origin](tls-headers-key-on-build-time-origin.md) — `headers()` is baked at build; `deploymentOrigin` outranks WEB_URL; VEN-606 bakes `SITE_ORIGIN` too
- [A new secret header has three registries](new-secret-header-has-three-registries.md) — pino `redact`, Sentry `CREDENTIAL_HEADER`, and a placeholder that must fail its own shape
- [The Resend secret's absence is refusal](resend-webhook-absence-is-refusal.md) — optional on every target is correct; no route exists without a secret
- [CSP `'unsafe-inline'` is a recorded trade-off](csp-unsafe-inline-is-a-recorded-tradeoff.md) — never add script-src hosts; CSP_ENFORCE only turns enforcement on
- [Deploy pipeline secret handling](deploy-pipeline-secret-handling.md) — child env/argv redacted; branch-as-environment falls back across tiers; `productionShape` gates no deploy; Resend key is full-access; VEN-660 Neon Auth preflight clean
- [CI e2e artifacts are public](ci-e2e-artifacts-are-public.md) — traces carry session cookies, stripe-listen.log carries whsec; masking never reaches artifacts
- [`.auth/*.json` was outside the secret scan](auth-storage-state-is-outside-the-secret-scan.md) — live session JWTs; `FORBIDDEN_PATHS` covers the path, no content rule will
- [A storage branch per lane, CI run and PR](neon-storage-branch-per-runner.md) — `NEON_API_KEY` is production-capable; keep it step-scoped and away from `npm install`
- [The no-trace guard fights the history scan](no-trace-guard-vs-history-scan.md) — `gitleaks git` reads every commit, so a scrubbed `.gitleaks.toml` entry reds CI for ever; fragment literals must actually split the needle
- [Backup integrity is not authenticity](backup-integrity-is-not-authenticity.md) — a bucket-token holder forges a dump the drill pg_restores as superuser

## Auth, identity and tenancy

- [Neon Auth cutover boundaries](neon-auth-cutover-boundaries.md) — verification sound, role double-narrowed; `updateName` (VEN-642) and the VEN-635 config fail-soft clean
- [The Terms gate is a five-state session](terms-gate-is-a-five-state-session.md) — `request.auth` is null for a gated account; `requireAuthSubject` (pre-Neon name, retired by VEN-447) is the deliberate exception
- [The server session cache's key is the whole gate](server-session-cache-key-is-the-cookie.md) — a hit skips the SDK's signature and revocation check; VEN-628's per-user `sessions_invalidated_at` outruns the other instances' caches
- [`getCurrentUser`'s cache() is safe; route dynamism is borrowed](identity-read-is-cached-and-route-dynamism-is-inherited.md) — `/` renders a booking amount with no `force-dynamic`
- [Email is a label, the auth id is the key (the pre-rename column is gone)](email-uniqueness-is-partial-nothing-joins-by-email.md) — `users_email_key` is partial and on `lower(email)` + lowercase CHECK since VEN-649; nothing resolves a person by email
- [Closing an account releases its address, scrubs the row, deletes uploads](closed-account-address-is-released.md) — partial index since #451; VEN-614 scrub + owner-prefix delete audited clean
- [The sign-up role is recorded server-side, first write wins](signup-role-is-confirmed-not-narrowed.md) — VEN-662: proxy records against the provider id; a squatter fixes the victim's role (Low)
- [Route handlers do not inherit layout gates](route-handlers-do-not-inherit-layout-gates.md) — `/admin/vendors/export` authorizes itself
- [Validation runs before preHandler guards](schema-validation-runs-before-prehandler-guards.md) — `requireAuthBeforeValidation` is the fix; two enum routes left low-severity on purpose
- [The event stream's auth is hand-rolled on purpose](stream-route-auth-is-hand-rolled.md) — adding `requireAuth` breaks it; removing the inline ban check is the regression; tickets outlive a session bump (VEN-670)
- [safeReturnPath is FIXED](validate-before-normalize-return-path.md) — parse-then-reserialise, 894k-case fuzz clean; VEN-653's one-path loop exemption audited clean
- [`x-orla-request-path` is forgeable only where nothing reads it](middleware-request-path-header-trust.md) — the matcher skips dotted paths
- [The role bounce loop is FIXED](role-bounce-self-loop-admin-bookings.md) — `roleCanReach` is a redirect hint and must never become a gate
- [Every `FORBIDDEN` is read as a suspension](every-forbidden-is-read-as-a-suspension.md) — `terminalRefusal` has no suspension-specific code, so widening its funnel sends stale-tab and tenancy 403s to a static "you are suspended" page

## Vendor visibility, moderation and PII

- [`VENDOR_VISIBLE` is the only public vendor gate](vendor-visible-is-the-only-public-vendor-gate.md) — VEN-431 added `OWNER_NOT_BANNED`; checkout has no vendor predicate and rests on the unwind
- [Moderation levers are undoable by their subject](moderation-levers-are-undoable-by-their-subject.md) — `moderation_hold`; both subject-wins paths closed on its own lane
- [Customer PII has two disclosure gates](customer-pii-has-two-disclosure-gates.md) — profile relationship is permanent and customer-wide, request-status is per-request; no shared code
- [Slug aliases reserve slugs for ever](vendor-slug-aliases-reserve-slugs.md) — VEN-648: successor/redirect clean; uncapped aliases let one vendor 409 a name's 50 slug attempts
- [The public vendor card is the widest anonymous projection](public-vendor-card-is-the-widest-anonymous-projection.md) — the DAO's literal decides, not the select; `isNew` is settled
- [The public price filter is a pricing oracle](search-price-filter-is-a-pricing-oracle.md) — any-package EXISTS binary-searched a tier ladder; MIN only exposes the printed price
- [`/places` replaced an inventory oracle](places-endpoint-replaced-an-inventory-oracle.md) — `/vendors/cities` leaked per-city counts; the missing `ESCAPE` is correct on Postgres
- [The data-rights export is hand-enumerated](data-rights-export-is-hand-enumerated.md) — a new `users` PII column reaches the console and not the subject's DSAR file
- [Response schemas are a second write boundary](response-schemas-are-a-second-write-boundary.md) — widen a write schema alone and a user's data 500s someone else's page
- [`'use client'` publishes a pane's props](client-component-props-are-public-html.md) — the RSC-payload lesson stands
- [JSON-LD is the only raw-HTML sink in web](json-ld-is-the-only-raw-html-sink.md) — `serialiseJsonLd` mandatory; the source guard misses `next/script` + non-literal type
- [`canBook` is chrome, not a gate](canbook-is-chrome-not-a-gate.md) — three server checks refuse a vendor; the prop degrades permissive on purpose
- [Vendor selection writes are transaction-only](vendor-selection-writes-are-transaction-only.md) — `replaceVendorTags`/`Categories` no longer self-transact
- [The `updatedAt` precondition is not a gate](edit-version-precondition-is-not-a-gate.md) — VEN-481 audited clean; the 409 body is the 200's projection, and an explicit `null` coerces to the epoch
- [The vendor agreement gate has four definitions](vendor-agreement-gate-has-four-definitions.md) — VEN-509 audited clean; publish/checkout/accept want the current version, payout takes any, and both EXISTS need `vendor_profiles` unaliased
- [Vendor invite gate checks before the row it creates](vendor-invite-gate-checks-before-the-row-it-creates.md) — VEN-512: a `vendor_applications` row now diverts `/accept-terms` for ever, and a GET writes one

## Money, bookings and background work

- [availability.status literals are load-bearing](availability-status-literals-are-load-bearing.md) — three double-booking guards compare to `'booked'`; a `syncHeldDate` without `lockHeldDate` deletes a concurrently booked cell
- [Availability floors are one day wider than UTC](availability-date-floors-are-universally-past.md) — the DAO's `booked` predicates protect history, not the floor
- [Booking reads gate on two separate paths](booking-reads-gate-on-two-separate-paths.md) — `reconcileBooking`'s short-circuit leaked the fee split until #387
- [The reply-window cap lives in five places](reply-deadline-cap-must-match-accept-guard.md) — VEN-433 gave `expires_at` a second meaning with no backfill
- [Refund idempotency keys carry the already-refunded total](refund-idempotency-key-is-parameter-sensitive.md) — VEN-477: dedup holds only while two racers read the same Stripe state
- [A refund with no durable record can happen twice](refund-before-row-move-can-double-refund.md) — past 24h a retry debits the vendor again
- [D31's proportional split is now our arithmetic](refund-proportionality-is-now-ours-to-state.md) — the pre-release cancel path states nobody's retained half
- [The payout sweep is a second money mover](payout-sweep-is-a-second-money-mover.md) — it takes a row lock the cancel and dispute paths do not
- [`payoutOwedClauses` is shared with the sweep](payout-owed-clauses-is-shared-with-the-sweep.md) — widening the vendor's read widens the `FOR UPDATE` claim that transfers
- [Settlement is a fourth money projection](settlement-is-a-third-money-projection.md) — `findSettlements` carries no ownership predicate; both callers pre-authorize
- [Legacy destination rows are guarded twice](legacy-destination-rows-guarded-in-one-place.md) — refund + unwind refuse them; the deploy window does not
- [Launch switches gate new intents, not open ones](launch-switches-gate-new-intents-not-open-ones.md) — an issued client secret survives the pause
- [Idempotency guards orphan their side effects](idempotency-guards-orphan-side-effects.md) — every `ON CONFLICT DO NOTHING` here fronts non-transactional follow-on writes
- [The background queue carries no session](background-work-queue-carries-no-session.md) — re-derive the recipient; never close over `request.auth` or a `tx`
- [`metadata.env` is the cross-deployment filter](env-tag-is-the-cross-deployment-filter.md) — VEN-529: one shared test account, a branched DB, so the intent tag is the only tier signal; filter order is load-bearing and the retrieve can 500 an alert path; VEN-644 balance check reads the shared balance
- [The e2e fixture now calls Stripe for real](e2e-fixture-creates-real-stripe-accounts.md) — one `sk_test_` prefix check keeps a live key out
- [`stripe_onboarded` entails an account id](stripe-onboarded-entails-account-id.md) — a CHECK; the `acct_` format check was refused as a product decision

## Account closure, bans and support

- [Closure refuses only the customer side](closure-refuses-only-the-customer-side.md) — a vendor closure refunds every future booking with an empty `closeBlockers`
- [The unwind's full refund is the ban's argument](account-unwind-full-refund-is-the-ban-argument.md) — superseded by D39: closure refused while a future confirmed booking exists
- [Ban and closure are resumable endpoints now](unwind-resume-is-a-repeatable-endpoint.md) — VEN-478; the derived pending gate never clears on a legacy/unrefundable booking, and double refund is settled
- [An unwind spares a request with a booking behind it](unwind-decline-spares-requests-with-a-booking.md) — unarrangeable; it closes a post-unban double-booking window
- [`cancelled_by` names the actor, not the suspended side](cancelled-by-does-not-say-which-side.md) — "the other account was suspended" is false to an unbanned customer
- [The acceptance record is undeletable PII](legal-acceptance-record-is-undeletable-pii.md) — closure is a soft delete, so the trigger's delete branch never fires
- [The support form is a public route that moves money](support-report-is-a-public-route-that-moves-money.md) — a `bookingId` on the unauthenticated send freezes a payout
- [A public endpoint mails the caller's own text anywhere](public-mail-endpoint-echoes-to-any-address.md) — the unverified-address echo is gated on `signedIn`
- [`support_cases` is the first durable copy of a complaint](support-cases-is-the-first-durable-copy-of-a-complaint.md) — the refund gate is a deny-list on Stripe's raw `dispute.status`
- [The staff read of a private thread is one `support_cases` row](conversation-read-grant-is-an-open-case-row.md) — no FK or CHECK constrains `subject_type='conversation'`
- [The admin action log is trigger-immutable](admin-action-log-is-trigger-immutable.md) — the one cascade exception needs a hard `users` delete no path performs
- [Messaging tenancy is two statements](messaging-tenancy-is-two-statements.md) — the preview subquery correlates only while the outer table stays unaliased

## Input, output and logging

- [URL params are validated in the nuqs hook](url-params-validated-in-the-nuqs-hook.md) — the hook is the boundary, not the screen
- [Image key columns are client-supplied](image-key-columns-are-client-supplied.md) — probe with the bucket-path base; `/_next/image`'s remote patterns are an anonymous fetcher and must derive from the storage env var; VEN-618 owner segment is a digest, raw id still accepted
- [Every image-ref bypass is FIXED; the host is not](image-ref-scheme-allowlist-is-whitespace-bypassable.md) — `https://evil.example/x.png` was never closed
- [The image pipeline is one process-wide 2-slot queue](image-pipeline-is-one-process-wide-queue.md) — VEN-464: hand-off is sound, the unbounded FIFO of 12 MB buffers is the ceiling; WebP input audited clean (VEN-618)
- [`freeText()` lets NUL through](free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand.md) — Postgres 22021 lets a caller pick which branch runs
- [Webhook payload text bypasses the bidi strip](provider-payload-text-bypasses-the-bidi-strip.md) — a hand-`safeParse`d schema is invisible to the free-text guard
- [Reviews: profanity floor, eligibility and tombstones](review-profanity-filter-is-a-hard-reject-floor.md) — tombstone finality rests on read order; a review can outlive a cancel
- [The `err` serialiser is the log sink](err-serializer-is-the-log-sink.md) — pino's three doors and bound params closed; the fields _beside_ `err` are verbatim, and the convention is an opaque id
- [Sentry is a second log sink](sentry-is-a-second-log-sink.md) — VEN-522 made `request.url` path-only; what escapes now is a header name the list misses and a shape no regex knows
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
- [`/ready` is unthrottled by design](ready-probe-is-unthrottled-and-now-reads-a-file.md) — VEN-495 sync read on the unlimited route; web `/api/ready` `runtimeEnv` presence booleans accepted (VEN-632)
- [Operator alert dedupe is attacker-armable](operator-alert-dedupe-is-attacker-armable.md) — a shed 429 costs a DB write; the email cap drops on a DB outage
- [The daily send cap's closure is sticky](email-send-cap-closure-is-sticky.md) — VEN-661: a closed day blocks step-up codes till UTC midnight; raising the cap does not reopen it

## Data layer, seeds and tooling

- [Fabricating seeds share one declared-branch guard](fabricating-seeds-share-one-declared-branch-guard.md) — `assertSafeTarget` trusts `.neon`/`NEON_BRANCH`, not the URL; VEN-649's `test:neon` skips it
- [The contention harness issues server DDL](contention-harness-issues-server-ddl.md) — CREATE/DROP DATABASE accepted because the name is a fresh UUID
- [The contention gate is a path pattern](contention-gate-is-a-path-pattern.md) — `verify.contentionPattern` misses `modules/payments/payments.*`
- [The categories cascade is single-edged, for now](categories-cascade-is-single-edged.md) — a second cascading FK onto `categories.id` is silent data loss
- [The `/search` retired-category 308 rests on three invariants](search-retired-category-redirect.md) — literal prefix, `Object.hasOwn`, no successor that is also a key
- [launch:check bearer hosts are fixed](launch-check-bearer-hosts-are-fixed.md) — re-open only if `bearer()` meets an env-built URL
- [Admin booking detail + requests funnel](admin-booking-detail-and-requests-reads.md) — PASS; reopen if the funnel ages rows or lists contact
- [Admin vendor detail is a gated aggregate](admin-vendor-detail-is-a-gated-aggregate.md) — widening notifications to `body` bypasses the case-row read grant
- [The staging probe spec's guard is the URL, not DEPLOY_ENV](staging-probe-spec-guard.md) — VEN-562: separate config and a required `STAGING_WEB_URL`; runs leave storefronts public
- [Admin category writes](admin-category-writes.md) — PASS; the toggle can double-write its audit row under a concurrent repeat
- [RLS is enabled, never forced](rls-is-enabled-not-forced-owner-bypasses.md) — VEN-504: the owner bypasses, so a future non-owner role reads zero rows silently; the guard is `relkind='r'` in `public`

- [Auth proxy parser differential](auth-proxy-parser-differential.md) — a body-derived rate-limit key must fail closed; sign-in tooling must not retry a credential refusal (10 failures/10 min locks a shared E2E identity); VEN-677 `change-password` budget and CSRF notes
