---
name: image-key-columns-are-client-supplied
description: Every image column holds a raw client-supplied string; the write guard must decide on the object a URL parser resolves to — and must be probed with the real S3_PUBLIC_URL, which carries a bucket path segment, not a bare origin
metadata:
  type: project
---

`imageRefSchema` accepts a bare object key, a site-relative path or an http(s)
URL, and the **client** chooses what string is persisted into
`portfolioItems.imageUrl` / `thumbnailUrl`, `vendorProfiles.profileImageUrl` /
`coverImageUrl` and `users.avatarUrl`. Every other vendor's keys are readable
with no auth at all — `GET /vendors/:slug` returns them raw.

**Two layers now exist, and they answer different questions.** `buildObjectKey`
mints `<prefix>/<ownerId>/<uuid>.webp` where `ownerId` is `users.id`
(`uploads.routes.ts` uses `uploader.id`, and all four write call sites pass
`auth.id`, so the ids genuinely match — verified 2026-09-05).
`ownsObjectKey` gates deletion; `assertOwnedImageRefs` (#407) gates the write,
refusing a three-segment key whose owner segment is another `users.id`. The
write guard is what matters, because `findUnreferencedKeys` compares **exact
strings**: a borrowed row makes the victim's own delete find the object still
referenced, so the object is served for ever with no way for them to remove it.
Exact-string matching also means every near-miss spelling
(`./portfolio/<victim>/x.webp`, `Portfolio/…`, `portfolio/<victim>//x.webp`,
`https://<cdn>/portfolio/<victim>/x.webp`) buys an attacker nothing there — all
are accepted by the guard, none of them counts as a reference.

**The defect class is "the guard parses the raw string; something downstream
normalises it".** Two normalisers do, and each one turns a spelling the guard
accepted into the object it refuses:
`packages/db/src/scripts/keys-from-urls.ts` (`keys:from-urls`, documented
re-runnable) strips `S3_PUBLIC_URL` and turns an absolute wrap into the bare
foreign key; and the **WHATWG URL parser** — which `resolveImageUrl`'s output is
handed to — deletes `.`/`%2e` segments **and treats `\` as `/` for http(s)
URLs**.

Closed so far (route-verified 2026-09-05, 403 at all three write routes): the
exact key, the absolute wrap in **any** origin including a bucket path
(`http://localhost:9000/vendor-marketplace-uploads/...`, R2-style, uppercase
scheme, explicit port), `.`, `%2e`, `./`, `\`, mixed `\`, `%2F`/`%2f`, and every
combination of those. The shape that gets it right: `normalizeImageRefPath` in
`packages/shared/src/utils/index.ts` shared with `imageRefSchema`, plus
scheme/authority stripping, `%2f` folding, dot-segment resolution, and a **scan**
for a known prefix with exactly two segments after it — the scan is what survives
`S3_PUBLIC_URL` having a bucket path. Same shape as
[[validate-before-normalize-return-path]].

**Still live at the time of writing: a query or fragment containing `/`.**
`portfolio/<victim>/1111.webp?a/b` and `...#/a/b` are stored with 201/200 at all
three routes; a URL parser drops everything from the first `?`/`#` before
resolving, so the browser fetches the victim's object while the extra segments
push the prefix out of the guard's three-from-the-end window. Fix is to end the
path at the first `?`/`#`, as a parser does. It does **not** re-open the
`keys:from-urls` chain (`toObjectKey` keeps the suffix, so the string never
exact-matches the key), so the harm is the theft half only.

**Probe with the real base, which has a path.** `S3_PUBLIC_URL` is
`http://localhost:9000/vendor-marketplace-uploads` locally and an R2 bucket URL
in deployment — an origin **and** a bucket segment. Three audit passes used
`http://cdn.test` (no path) and every one of them missed that the absolute form
of a key is `<origin>/<bucket>/<prefix>/<owner>/<name>`, so the prefix is not
first. A guard keyed on position passed every test and was bypassed in a browser
by the very string `GET /vendors/:slug` publishes. **Any sweep here must use a
base with a path segment, and must model the object key as the origin derives it
(decode the pathname once, strip the bucket prefix) rather than comparing URLs.**

**Enumerating spellings is the trap that produced the third pass.**
`storage.test.ts`'s "refuses every spelling that resolves onto another account's
object" reads like a property but its list is hand-written: the suite was green
at 114 tests while backslash was live. It only holds because the guard now
normalises with the parser's own rules — treat the list as documentation, not as
the guarantee, and re-probe generatively when this code changes.

**Two invariants worth re-checking rather than assuming, both measured clean:**
`ownsObjectKey` is byte-for-byte HEAD's behaviour (26,946 keys x 4 owners, 0
disagreements) — widening only the write guard means the reap set can never
grow; and extracting the schema's inline normalisation changed nothing
(16,302-value differential against HEAD's predicate, 0 disagreements, identical
parsed output).

**What was never closed, by decision:** displaying someone else's image. Any
https host is allowed, including our own CDN, so hotlinking a rival's photo onto
your storefront needs no trick at all — see
[[image-ref-scheme-allowlist-is-whitespace-bypassable]]. #407's docstrings say
"not only theft of the image", which overstates what the guard does; the half it
really closes is the reap-blocking one.

**How to apply:** treat any new code that _acts on_ one of these columns —
delete, copy, sign, fetch, move, or **normalise** — as taking an attacker-chosen
key. `syncCoverFromPortfolio` copies a key between two of the same owner's rows,
so a "still referenced?" test is needed alongside the ownership test. The
cross-route guard is `apps/api/src/request-body-image-ref.test.ts`: it discovers
body schemas from the route files but proves the call only by **scanning the
service source**, so it cannot see a call passing the wrong refs or the wrong
owner id.
