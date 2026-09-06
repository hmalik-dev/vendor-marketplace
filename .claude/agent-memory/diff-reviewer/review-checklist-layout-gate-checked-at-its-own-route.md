---
name: review-checklist-layout-gate-checked-at-its-own-route
description: Source-scan guards that map a gate file to "its" route check a layout only at the layout's own URL, so a rule narrower than the protected subtree passes both directions
metadata:
  type: feedback
---

When a guard test reads gates out of `app/` and compares them to a route table,
check **what route it evaluates the gate at**. A gate in `app/admin/layout.tsx`
protects `/admin/**`, but `routeOf(file)` yields only `/admin` — so a rule
written `/^\/admin$/` satisfies the forward check (no disagreement at `/admin`)
and the backward check (a gate backs it), while every child route falls through
the table's default.

**Why:** #410's guard (`apps/web/src/lib/role-routes.guard.test.ts`) passed with
the admin rule narrowed to an exact match, at which point
`roleCanReach('customer', '/admin/reviews')` returned `true` — the exact input
that reproduces the blank-page bug the table exists to prevent. The rules
shipped are prefix-shaped, so nothing was broken; the safety net was.

**How to apply:** replicate the guard in a scratch script over the real tree,
then mutate the table one rule at a time — drop it, widen it, and **narrow it to
an exact match**. A mutation that yields zero disagreements is a hole. Ask
additionally: which subtrees have gates _only_ in a layout (no per-page
`requireRole`)? Those are the ones the narrowing mutation escapes.

Second, smaller gap from the same review: a scan keyed on one helper name
(`requireRole(`) is blind to a hand-written `if (user.role !== 'admin')`, which
`app/admin/vendors/export/route.ts` really does. Grep for the inline form before
believing a guard's "both directions" claim.

Related: [[review-checklist-source-grep-substring-collisions]],
[[review-checklist-source-guard-regex-truncation]].
