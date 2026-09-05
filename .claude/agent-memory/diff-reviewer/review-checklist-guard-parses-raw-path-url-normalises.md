---
name: review-checklist-guard-parses-raw-path-url-normalises
description: An ownership guard that splits a stored path string is bypassed by dot segments the URL parser removes later; feed it "a/b/./c" and compare with new URL()
metadata:
  type: project
---

An authorization guard that parses a **stored path string** (`key.split('/')`,
`segments.length !== 3`, `segments[1] === ownerId`) is checked against a
spelling nobody serves. The value is later concatenated into a URL, and the URL
parser removes `.` and `%2e` segments — so `prefix/<victim>/./name.webp` has
four segments, yields _no_ owner, sails past the guard, and resolves to
`prefix/<victim>/name.webp` in every browser and in `next/image`'s fetch.
`./prefix/<victim>/name.webp` does the same.

**Why:** #407 shipped `assertOwnedImageRefs` in `apps/api/src/lib/storage.ts`
with exactly this hole. The write schema (`imageRefSchema`) only rejects `..`
and a leading `//`, so a single dot segment is legal input; the guard's unit
tests listed a legacy key, a site path, a Clerk URL and an unknown prefix — no
normalization case — so the whole suite stayed green.

**How to apply:** whenever a diff adds a guard that decides ownership by
splitting a path, run the candidate through the _write_ schema and then through
`new URL(value, base)`. If the normalized href differs from the string the
guard parsed, the guard is deciding about a different object than the one that
gets served. Same question for `%2F`, backslashes, and any place the reap /
reference lookup compares keys with exact string equality (`inArray`), which
silently disagrees with the guard's parse.
