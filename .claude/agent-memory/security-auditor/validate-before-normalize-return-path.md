---
name: validate-before-normalize-return-path
description: safeReturnPath decodes then returns the decoded string and checks the un-normalized pathname, so the value validated is not the value redirected to
metadata:
  type: project
---

`apps/web/src/lib/return-path.ts` (`safeReturnPath`, added by #116) validates a
string that is **not** the string the redirect finally uses. Two separate gaps,
same root cause: it hand-rolls string checks instead of parsing with the WHATWG
URL parser and re-serialising.

1. **Returns the decoded value.** `decodeURIComponent(value)` promotes encoded
   `&`, `=` and `#` inside the destination's query into structural delimiters
   _after_ the check passed. `?package=a%26foo%3Dbar` becomes
   `?package=a&foo=bar` in the final target — query-parameter injection into a
   destination the validator called safe.
2. **Checks the un-normalized pathname.** The `LOOPING_PREFIXES` test runs on
   `candidate.split(/[?#]/)[0]` before `new URL(target, request.url)` in
   `/after-sign-in` collapses dot segments. `/x/../sign-in`, `/./sign-in`,
   `/a/b/../../sign-up` and `/x/%252e%252e/sign-in` all pass the guard and land
   on the auth flow anyway.

**Why:** the origin check itself is sound — 400k-case fuzzing at both the direct
and the through-a-query-decode entry points produced zero foreign origins, because
`startsWith('/')` + `!startsWith('//')` + no backslash + no control character is
enough for the WHATWG parser (it leaves path state only for `//`, `\` on a special
scheme, or a scheme; it strips only tab/LF/CR and leading/trailing C0-or-space;
U+2044 and U+FF0F are not normalised to `/`). The defects are in what it _returns_,
not what it _rejects_.

**How to apply:** the shape that fixes both at once is parse-then-reserialise —
`new URL(value, 'https://placeholder.invalid')`, reject unless `url.origin` is
unchanged, run the loop check on `url.pathname`, return
`url.pathname + url.search + url.hash`. Do not add more string predicates.

Related: [[clerk-redirect-url-param-collision]], [[url-params-validated-in-the-nuqs-hook]]
