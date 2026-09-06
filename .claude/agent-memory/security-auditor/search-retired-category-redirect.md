---
name: search-retired-category-redirect
description: /search answers a retired category with a 308 built by successorSearchPath; its safety rests on three invariants, and re-auditing it means checking those, not re-fuzzing the encoder
metadata:
  type: project
---

`/search` is the only public unauthenticated route in `apps/web` that answers
`searchParams` with a redirect (`permanentRedirect`, HTTP 308, added #419).
Audited clean 2026-09-06. Its safety is not "URLSearchParams escapes things" —
it rests on three invariants, and a future change is dangerous only if it breaks
one of them:

1. **The destination prefix is a literal.** `successorSearchPath` returns
   `` `/search?${query.toString()}` ``. The attacker never contributes the
   scheme, host or path — only the query, and only through
   `URLSearchParams.append`, which percent-encodes CR, LF, `/`, `\`, `:` and `#`
   in _both_ key and value. Verified by fuzzing keys and values with
   `//evil.com`, `\\evil.com`, `javascript:`, and CRLF + `Location:`.
2. **The successor comes from a closed literal, gated by `Object.hasOwn`.**
   `retiredCategorySuccessor` in `packages/shared/src/constants/index.ts`. The
   `hasOwn` is load-bearing: without it `?category=constructor` resolves to
   `Object` and redirects to `/search?category=function%20Object`. Do not
   "simplify" it to a plain lookup or `in`.
3. **No value in `CATEGORY_SLUG_SUCCESSORS` is also a key.** That is what makes
   the redirect terminal — one hop, never a loop. It is also what makes the
   _seed_ fold order-independent, since `applyCategorySuccessors` iterates
   `Object.entries` in insertion order. #419 hand-repointed `floristry` from
   `florals` to `decor` for exactly this reason. **Adding an entry whose value
   is an existing key creates both a redirect chain and an order-dependent
   migration.** That single check is the whole review of a new entry.

**Why:** the entry point is a URL anyone can paste, it is unauthenticated, and
a 308 is cacheable — so a mistake here is both remotely reachable and sticky.

**How to apply:** when a diff touches `apps/web/src/lib/search-params.ts`,
`retiredCategorySuccessor`, or `CATEGORY_SLUG_SUCCESSORS`, check the three
invariants and stop. Do not re-fuzz the encoder; that ground is covered.
Hostile params other than `category` are carried across verbatim on purpose and
are absorbed downstream by the Zod schema in
`apps/web/src/components/search/search-state.ts` — see
[[url-params-validated-in-the-nuqs-hook]]. Related:
[[validate-before-normalize-return-path]].
