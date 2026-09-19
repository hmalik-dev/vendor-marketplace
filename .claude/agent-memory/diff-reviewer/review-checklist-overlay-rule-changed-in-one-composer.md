---
name: review-checklist-overlay-rule-changed-in-one-composer
description: When a diff changes a read-time overlay's precedence rule, grep for the sibling composer whose comment cites it by name — admin composeLocks vs availability readCalendar
metadata:
  type: feedback
---

A read-time overlay's precedence rule ("a stored row wins its date over the
request overlay") is usually implemented **twice**: once on the owner's surface
and once on the console that explains it. `readCalendar`
(`apps/api/src/modules/availability/availability.service.ts`) and `composeLocks`
(`apps/api/src/modules/admin/admin-detail.service.ts`) are that pair, and
`composeLocks`' doc comment says _"exactly as `readCalendar` overlays"_.

**Why:** VEN-432 relaxed the rule on the vendor calendar only — a stored
`available` row (what a cancellation leaves) stopped suppressing the `pending`
overlay. The console kept suppressing it, so a date the vendor's calendar now
locks lists **no holder at all** on `/admin/vendors/:id` — the exact "stale
lock an operator arrives asking about" case the lock list exists for. Its route
test pinned the old behaviour with a comment asserting parity, so the whole
gate stayed green on a claim that had become false.

**How to apply:** grep the changed function's **name** across `apps/api/src`
before judging scope. A comment or test naming it is a second implementation of
the rule, and a prose cross-reference that survives a behaviour change is a
finding in itself. Also check the dedup that accompanies the relaxation covers
every status the overlay no longer suppresses, not only the one in the ticket
(`shown` filtered `status === 'available'`; filtering all overlaid dates is
equivalent and cannot drift).
