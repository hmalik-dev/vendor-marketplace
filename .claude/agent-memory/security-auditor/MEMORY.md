# Security auditor memory — vendor-marketplace

- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps must pass `baseline`; `local` bricks the Vercel build and no test covers the choice
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a PreToolUse hook blocks credential-shaped literals on any bash command line, probe scripts included
- [Idempotency guards orphan their side effects](idempotency-guards-orphan-side-effects.md) — every ON CONFLICT DO NOTHING here fronts non-transactional follow-on writes; the retry absorbs the half-failed first attempt
- [URL params are validated in the nuqs hook](url-params-validated-in-the-nuqs-hook.md) — nuqs types but never validates; the hook is the boundary, not the screen
- [.env.lane mode is not repaired on rewrite](lane-env-file-mode-not-repaired.md) — writeFileSync's `mode` applies only on create, and no test asserts 0600
- [`redirect_url` is Clerk's param, not ours](clerk-redirect-url-param-collision.md) — the raw search param outranks `fallbackRedirectUrl`, skipping our validator and `/after-sign-in`
- [safeReturnPath's validate/return mismatch is FIXED](validate-before-normalize-return-path.md) — parse-then-reserialise landed in #76; 894k-case chain fuzz is clean, do not re-report
- [`x-orla-request-path` is forgeable only where nothing reads it](middleware-request-path-header-trust.md) — the matcher skips dotted paths; slugSchema and 404s close the gap
- [The role bounce can redirect into itself](role-bounce-self-loop-admin-bookings.md) — `DASHBOARD_PATH_BY_ROLE.admin` is `/bookings`, which is `requireRole('customer')`-gated
- [Response schemas are a second write boundary](response-schemas-are-a-second-write-boundary.md) — widen a write schema without the read schemas on the same column and a user's data 500s someone else's page
- [imageRefSchema's scheme check is whitespace-bypassable](image-ref-scheme-allowlist-is-whitespace-bypassable.md) — `" javascript:…"` validates; only `resolveImageUrl`'s trim-then-prefix keeps it harmless
- [Customer PII has two disclosure gates](customer-pii-has-two-disclosure-gates.md) — the profile relationship gate is permanent and customer-wide; the request-status gate is per-request, and they share no code
- [availability.status literals are load-bearing](availability-status-literals-are-load-bearing.md) — three double-booking guards compare to `'booked'`; redefining what a lifecycle writes needs a migration, not a code change
- [The error handler's 4xx passthrough leaks SDK messages](error-handler-4xx-passthrough-leaks-sdk-messages.md) — any thrown object with `statusCode` 4xx answers with its own `message`; Stripe errors carry both
- [Webhook error objects carry the redacted header](webhook-error-objects-carry-the-redacted-header.md) — `log.warn({err})` re-emits `stripe-signature` and the raw body around the `redact` path
