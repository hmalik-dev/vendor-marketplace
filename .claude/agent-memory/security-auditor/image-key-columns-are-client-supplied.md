---
name: image-key-columns-are-client-supplied
description: Every image column holds a raw client-supplied string; the write guard must decide on the object the ORIGIN derives — probe with the bucket-path S3_PUBLIC_URL and differential the guard against a model of that derivation, not against a spelling list
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

The last class found was a **query or fragment containing `/`**
(`portfolio/<victim>/x.webp?a/b`): a parser drops everything from the first
`?`/`#`, but `split('/')` counted the slashes inside it and pushed the prefix out
of the window. Closed in `39e9c0d` by cutting `[?#]` — verified 0 accepted across
the whole corpus afterwards.

**The check that replaced the spelling lists, and the one to re-run.** Model what
the _origin_ derives (resolve the ref, parse the URL, decode the pathname once,
strip the bucket prefix, require three non-empty segments) and assert: if that
key names an account other than the caller, the guard must refuse. Recover the
guard's answer by probing `assertOwnedImageRefs` with different caller ids, so
the test is of behaviour rather than a copy of the implementation. Over 336k
schema-valid mutations of real keys per seed, ~132k of which name another
account, violations are **0** on four seeds. Generate by mutating a real key —
free-form generation almost never lands on `<prefix>/<owner>/<name>` and looks
clean for the wrong reason. A first model that allowed an **empty** name segment
produced dozens of false violations (`portfolio/<victim>/` addresses no object);
the model was wrong, not the guard.

**The local MinIO answers how it derives a key, for free.** A GET of a missing
object returns `NoSuchKey` with the derived `<Key>` echoed in the XML — no
credentials, no writes, no listing. Measured 2026-09-05:
`portfolio%2Fabc%2Fx.webp` → `portfolio/abc/x.webp` (so the `%2f` fold is
load-bearing); `%252F` → `portfolio%2Fabc%2Fx.webp`, decoded exactly **once** (so
accepting double-encoded spellings is safe); `…/x.webp?a/b` → `portfolio/abc/x.webp`
(the query is ignored, which is why it was a bypass); a literal `%2e` segment is
refused outright as a bad component.

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
