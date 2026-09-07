---
name: review-checklist-repo-wide-source-guards-fire-on-new-files
description: A new web file can be green in isolation and red in the suite — this repo has repo-wide source scanners (parity ledger, apostrophe form, truncate scan) that no diff hunk shows; always run the changed package's whole suite
metadata:
  type: feedback
---

Run the **whole** test suite of every package the diff touches, not just the new
test file the diff added. Reading the diff cannot show you a guard whose input is
"every file under `apps/web/src/app`".

**Why:** on #438 the lane's own new suites were green — `data-rights.routes.test.ts`
18/18, the full API suite 1141/1141, `pnpm typecheck` clean — and `pnpm --filter
web vitest run` was **4 tests red in 3 files**, every one of them tripped by a
single new page the diff added:

- `src/app/route-parity-ledger.test.ts` — enumerates every route directory under
  `apps/web/src/app` and demands a frame in `.claude/plans/parity-sweep-ledger.md`
  or an exemption in `design/design-plan/00-README.md`. **Any new route directory
  fails this until the ledger is edited**, and the ledger is not in the diff.
  It fails twice: once on the real list, once on the synthetic-route control test.
- `src/apostrophe-form.test.ts` — scans sources for `&rsquo;`. New JSX prose that
  writes `party&rsquo;s` fails it.
- `src/components/admin/frame-13-parity.test.ts` — regexes
  `truncate|text-ellipsis|whitespace-nowrap|line-clamp-\d+` over the DataTable
  column sources, after stripping `/* */` and `//` comments **but not JSX text**.
  A page whose visible copy contains the _word_ "truncate" ("three triggers refuse
  an update, a delete and a truncate") fails it.

**How to apply:** for any diff that adds a file under `apps/web/src`, run
`pnpm --filter @vendor-marketplace/web exec vitest run` before writing the report.
For a new `app/` route directory, check the parity ledger and the exemption list
by name — the absence is invisible in `git diff`. See also
[[review-checklist-source-grep-substring-collisions]] and
[[review-checklist-source-guard-regex-truncation]] for the other direction:
guards that pass when they should not.
