---
name: legal-acceptance-record-is-undeletable-pii
description: legal_acceptances stores IP + user agent for EVERY user since #429, and account closure is a soft delete, so the trigger's only delete branch is unreachable in production
metadata:
  type: project
---

`legal_acceptances` stores `ip` and `user_agent` per acceptance. Since #429 the
row's subject is the **user**, so every account gets one at first sign-in — not
just vendors — and `document_sha256` + `acceptance_method` were added beside
them.

**The record cannot be redacted and, in production, cannot be deleted.** The
trigger `legal_acceptances_are_immutable` refuses every UPDATE outright, so
there is no redaction path at all. Its two DELETE branches (migration `0030`)
are:

1. `NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.accepted_by_user_id)`
2. `OLD.vendor_id IS NOT NULL AND NOT EXISTS (… vendor_profiles …)`

Both foreign keys are `NOT NULL`/`ON DELETE CASCADE`, so each branch is true
**only** during that parent's cascade. A Terms row carries `vendor_id IS NULL`,
so branch 2 never fires for it — and the product never hard-deletes a `users`
row: Clerk `user.deleted` lands on `softDeleteUserByClerkId`, which sets
`deleted_at` and keeps the row for referential integrity. Only `seed-demo.ts`
and `seed-marketing.ts` issue `db.delete(users)`.

Net: **every user's IP and user agent is permanent**, and
`apps/web/content/legal/privacy.md` ("Your rights") says "Closing the account
removes it along with everything else." That sentence is false.

**Why:** the immutability is the table's whole value in a dispute, so it is
correct — but it turns any column on it into unerasable personal data, and the
privacy page is a public claim the code has to satisfy the way the fee
constants satisfy `legalFactTokens()`.

**How to apply:** any diff that adds a column to `legal_acceptances`, widens who
gets a row, or collects a new address/device string anywhere is also a change to
`privacy.md`. Do not accept "it is only recorded, never trusted" — recorded _is_
the processing. Check `softDeleteUserByClerkId` before believing any "closing
the account removes it" claim. The values are write-only today (no DAO selects
`ip`/`user_agent`, and `legalAcceptanceSchema` strips them from every response),
which is the one thing keeping this off a rendered surface. See
[[terms-gate-is-a-five-state-session]] and
[[cancelled-by-does-not-say-which-side]].
