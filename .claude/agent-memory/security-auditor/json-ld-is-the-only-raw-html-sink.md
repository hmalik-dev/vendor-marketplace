---
name: json-ld-is-the-only-raw-html-sink
description: The two JSON-LD blocks are the only dangerouslySetInnerHTML in apps/web; serialiseJsonLd is mandatory and a source-scan test pins the file set, with one blind spot
metadata:
  type: project
---

`apps/web` has exactly two raw-HTML sinks — the `application/ld+json` blocks on
`app/page.tsx` and `app/vendors/[slug]/page.tsx`. Both must serialise through
`serialiseJsonLd` (`packages/shared/src/utils/index.ts`), never `JSON.stringify`;
bare stringify was stored XSS via `businessName`/`bio` (#398, fixed 2026-09-04).
`apps/web/src/app/json-ld-escaping.test.ts` enforces it by scanning source text
and asserting the exact file set.

**Why:** React does not escape through `dangerouslySetInnerHTML`, and the HTML
tokeniser enters script-data state on the `script` tag name regardless of
`type="application/ld+json"` — so only `<` can end the element. Escaping `<`,
`>`, `&`, U+2028 and U+2029 to `\uXXXX` closes it completely: those characters
can only appear inside a JSON string literal, `\uXXXX` is valid JSON, and a
backslash in the input is already doubled by `JSON.stringify`, so no parse step
reconstructs a raw `<`. Verified by round-tripping a hostile payload with `<` in
a **key**, nested arrays, NUL, and both separators.

**How to apply:** Any new structured-data block is a finding unless it routes
through `serialiseJsonLd`. The guard has one blind spot: a block emitted through
`next/script` children _and_ with the type in a constant rather than the literal
`application/ld+json` matches none of the three assertions. That combination is
inert anyway (React entity-escapes text children, which breaks the JSON rather
than the element), so it is a low-severity gap, not a hole. The guard also only
walks `apps/web/src` — a JSON-LD emitter added under `packages/` escapes it.
Related: [[image-key-columns-are-client-supplied]],
[[image-ref-scheme-allowlist-is-whitespace-bypassable]].
