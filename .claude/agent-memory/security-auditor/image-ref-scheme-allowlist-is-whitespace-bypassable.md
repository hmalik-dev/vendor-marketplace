---
name: image-ref-scheme-allowlist-is-whitespace-bypassable
description: imageRefSchema's http(s)-only check is skipped by a leading space or newline, so " javascript:alert(1)" validates; only resolveImageUrl's trim-then-prefix keeps it out of an img src
metadata:
  type: project
---

`packages/shared/src/schemas/index.ts` `imageRefSchema` decides "is this an
absolute URL?" with `/^[a-z][a-z0-9+.-]*:/i`. A leading space, tab or newline
makes that fail, so the value falls into the *relative path* branch, which only
rejects `//` and `..`. Verified accepted: `" javascript:alert(1)"`,
`"\njavascript:alert(1)"`, `"jav\tascript:alert(1)"`, `"/\\evil.com/x.png"`.

Not exploitable as written: the single consumer, `resolveImageUrl`, trims and
then prefixes anything that is not `https?://` or `/`-leading with the CDN base,
and avatars only ever reach `<img src>`, where `javascript:` does not execute.
The exposure is one careless consumer away — an `<a href>`, an email template,
or a server-side fetch of a stored ref.

**Why:** this is the same validate-before-normalize shape as
[[validate-before-normalize-return-path]]: the validator sees the untrimmed
string, the consumer sees the trimmed one.

**How to apply:** if a diff adds a consumer of a stored image ref, or edits
`imageRefSchema`, require `.trim()` (and control-character rejection) *before*
the refine rather than trusting the resolver. Related:
[[response-schemas-are-a-second-write-boundary]].
