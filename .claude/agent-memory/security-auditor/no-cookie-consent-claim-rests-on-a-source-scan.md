---
name: no-cookie-consent-claim-rests-on-a-source-scan
description: /cookies states as fact that the product sets no cookie; the only thing holding that true is one regex list in no-cookie-consent.test.ts
metadata:
  type: project
---

`apps/web/content/legal/cookies.md` asserts there is no consent banner because
the product sets no cookie of its own and loads no tracker. The guard is
`apps/web/src/app/no-cookie-consent.test.ts`, and it is the only thing between
that public claim and a regression.

The tracker and consent scans are sound — `sourceFiles` strips comments
(`withoutComments`) and skips `.test.` files, so the prose quoting the forbidden
patterns cannot self-match, and `/cookie[-_ ]?consent/` does not match its own
regex source. **The "writes no cookie of its own" scan is not.** It matches
`cookies().set`, which cannot exist under Next 15.5 where `cookies()` is async;
the reachable shapes are `(await cookies()).set(...)`, a destructured store, and
`response.cookies.set(...)` in `apps/web/src/middleware.ts` — none matched. The
walk is also limited to `apps/web/src`, so `next.config.ts`, `instrumentation.ts`
and any `Set-Cookie` from `apps/api` are outside it.

**How to apply:** treat every factual claim in `content/legal/` as an assertion
the code owes a guard, and audit the guard rather than the sentence. See
[[source-grep-guards-match-their-own-comment]] for the failure mode this file's
comment-stripping already avoids.
