---
name: ven765-decline-reason-tripped-three-source-guards
description: quote-review.tsx's decline dialog (VEN-765) fails apostrophe-form, design-tokens and focus-ring-guard tests; component tests alone did not catch it
metadata:
  type: project
---

VEN-765's `DeclineQuote` addition to `apps/web/src/components/bookings/quote-review.tsx`
passes its own component tests but fails three unrelated project-wide source-scan
guards, found only by running the **full** `pnpm --filter web test`, not the
component's own test file:

- `apostrophe-form.test.ts` — the dialog description uses a literal curly `’`
  (`you’ve declined`) instead of the straight `'` the guard requires.
- `design-tokens.test.ts` — the `Message about this request` link's
  `rounded-xs` is a third "undefined radius" the ratchet does not allow
  (`KNOWN_UNDEFINED_RADII` only has two recorded).
- `focus-ring-guard.test.ts` — the file imports and applies `FIELD_FOCUS`
  (in `REASON_FIELD`, passed to `Textarea`) but never writes `data-focus-own`
  itself; the guard is file-scoped so it does not credit `Textarea`'s own
  internal pairing in `ui/textarea.tsx`. Likely a harmless redundant
  re-application (Textarea already carries `FIELD_FOCUS` + `data-focus-own`
  internally) rather than an actual double-ring, but it still fails the ratchet
  as written.

**Why:** a scoped `--` test filter argument to `pnpm test` was silently
ignored by turbo/vitest in this repo and ran the whole web suite instead —
which is how this was caught. A narrower, ticket-scoped test run (e.g. via
`verify.mjs`) could plausibly miss these if it only runs the new/changed
test file rather than the whole suite.

**How to apply:** when a ticket's own tests are green, still run the full
`pnpm --filter @vendor-marketplace/web test` (or `verify.mjs`) before calling
a diff clean — new source-scan ratchets (apostrophe form, design tokens,
focus-ring-guard) are enforced repo-wide and are not visible from a component
test file alone.
