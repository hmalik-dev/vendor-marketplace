---
name: image-ref-scheme-allowlist-is-whitespace-bypassable
description: "The LEADING-whitespace bypass is fixed — .trim() runs before the refine, so \" javascript:…\" is rejected. What is still live is an INTERIOR tab/newline in the scheme, and `/\\evil.com` stepping around the protocol-relative guard. Filed as #414"
metadata:
  type: project
---

**Corrected 2026-09-04 by measurement against the built schema.** The headline
this file used to carry — that a leading space or newline skips the http(s)
check, so `" javascript:alert(1)"` validates — is **no longer true**.
`imageRefSchema` runs `.trim()` before its `.refine()`, and Zod applies the
transform first, so all of these are **rejected**:

    " javascript:alert(1)"      "\njavascript:alert(1)"      "//evil.com/x.png"
    "javascript:alert(1)"       "../secret.png"

Do not re-report it. It was reported from reading the regex without running it.

**What is still live**, and is now **#414**:

- `/\evil.com/x.png` is **accepted**. `startsWith('//')` does not see it, and
  `resolveImageUrl` returns any `/`-leading value verbatim, so it reaches
  `<img src>` as written and the URL parser normalises `\` to `/` — the browser
  requests `//evil.com/x.png`. The enforced `img-src` blocks it in a browser;
  an email template carries no CSP.
- `jav\tascript:alert(1)` and `jav\nascript:alert(1)` are **accepted**: the
  anchored scheme regex fails on the interior control character, so the value
  falls into the relative-path branch that never checks a scheme. Browsers strip
  tabs and newlines before parsing a scheme.
- Bidi controls are accepted, and that one is **inert** — the value is
  percent-encoded into a URL and no surface renders it as text. It is why
  `apps/api/src/request-body-free-text.test.ts` excludes image references from
  the free-text boundary rather than folding them in.

**Why:** the fixed half and the live half share a file, a validator and a shape,
so "the image-ref scheme check is bypassable" is true and useless — it sends the
next reader to re-report the half that was fixed. The two halves differ in where
the whitespace sits, and only measurement tells them apart.

**How to apply:** before reporting anything about this schema, parse the case
against `packages/shared/dist`. Related:
[[validate-before-normalize-return-path]], which is the same
validate-before-normalize shape and is also already fixed, and
[[response-schemas-are-a-second-write-boundary]].
