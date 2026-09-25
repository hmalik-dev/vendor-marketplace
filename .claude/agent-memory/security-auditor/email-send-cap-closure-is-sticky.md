---
name: email-send-cap-closure-is-sticky
description: VEN-661 daily Resend send cap (email_send_days) — a closed day refuses every send incl. admin step-up codes until UTC midnight, and neither raising the cap nor a Resend upgrade reopens it
metadata:
  type: project
---

VEN-661 wraps the one email gateway in `withDailySendCap` (`apps/api/src/lib/email-send-cap.ts`):
a conditional upsert reserves a slot per **attempt** (failures included), and
`closed_reason` (`cap`|`quota`) closes the UTC day. `reserveSend`'s `setWhere`
is `closed_reason IS NULL AND sent < cap`, so a closure is **sticky**: raising
`EMAIL_DAILY_SEND_CAP` (the rule file's documented lever) does not reopen the day.

Audited 2026-09-23 (uncommitted), clean on: tier default (`dailySendCapFor`
keys on `DEPLOY_ENV === 'production'`, 0 = log-only elsewhere, fails closed),
log/Sentry payloads (day/reason/cap only; the 429 body yields just an
allow-listed `name`), RLS (enabled, not forced, no policies — project norm,
see [[rls-is-enabled-not-forced-owner-bypasses]]).

Flagged: closure blocks `startStepUp` → every `irreversible` admin route
(`admin.routes.ts` `[adminOnly, requireStepUp]`) until midnight; attacker cost
is ~7 IPs × `POST /support/messages` (6/h/IP, 2 sends each). Same class as the
old Resend-quota exhaustion, worse on recovery. Also: `reserveSend` needs the
DB, so `alertNow`'s "send unrecorded on DB failure" fallback is now dead;
a cap > int4 max 22003s every send.

**Resolved in the same PR:** `essential` mail (step-up, operator alerts, the
digest) may take `ESSENTIAL_SEND_HEADROOM` (15) slots past a `cap` closure and
sends uncounted when the reservation hits a DB error; the plugin's boot runs
`reopenCapClosedDay`, so the redeploy that raises the cap reopens the day; the
env shape is bounded to six digits. Only a `quota` closure stays until UTC
midnight, which is Resend's own refusal anyway.

**VEN-688 (audited 2026-09-24, PASS):** `email_send_days.cap` records the highest
env cap any instance used today (`greatest`); only env values reach it, so lowering
waits for UTC midnight (documented; `0` still kills sending at once). A cap refusal
writes a `failed` row with the literal `SEND_CLOSED_FAILURE_REASON`, excluded from
attempt counts. Webhook `bounceReason` can write that exact text (bare
`bounce.message` from the remote MTA), but only onto a `bounced` row with a provider
id, which already blocks retries; the 24h window bounds Resend attempts whatever
the count says. If refusals ever get a column or outcome, prefer it over the text.

**How to apply:** do not re-report the stickiness or the step-up lockout;
check instead that new operator-bound senders set `essential: true`.
Related: [[operator-alert-dedupe-is-attacker-armable]], [[public-mail-endpoint-echoes-to-any-address]].
