---
name: image-key-columns-are-client-supplied
description: Every image column holds a raw client-supplied string; #407's assertOwnedImageRefs decides on the object a URL parser resolves to, not the stored spelling — all known bypasses (absolute wrap, dot segments, backslash, %2f) are CLOSED and verified at the route level
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

**All of it is CLOSED as of #407's third pass — do not re-report.** Verified
2026-09-05 by driving the real Fastify app: 14 hostile spellings (exact key,
absolute wrap incl. uppercase scheme and a port, `.`, `%2e`, `./`, `\`, mixed
`\`, `%2F`, `%2f`, `\`+dot, `\`+`%2e`, whole-path `%2F`) answer **403 at all
three write routes**, and a 58-spelling sweep found **zero** refs that both
resolve onto another account's object and are accepted. The fix's shape is what
matters: `normalizeImageRefPath` in `packages/shared/src/utils/index.ts` is now
shared by `imageRefSchema` and by `referencedObjectKey`, which adds
scheme/authority stripping, `%2f` folding and dot-segment resolution on top —
i.e. the guard decides on the object the parser will fetch, not on the spelling.
Same shape as [[validate-before-normalize-return-path]].

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
