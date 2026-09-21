---
name: image-ref-scheme-allowlist-is-whitespace-bypassable
description: "imageRefSchema's whitespace, backslash and control-character bypasses are all FIXED (#414). What remains by design is that the absolute branch allows ANY https host — the ticket's own threat model survives its own fix. Do not re-report the bypasses."
metadata:
  type: project
---

> **The auth provider is retired** (VEN-447/448/449 moved auth to Neon Auth). The auth provider names below describe the pre-cutover code and are historical; do not act on them as live.

**Corrected twice by measurement against `packages/shared/dist`, most recently
2026-09-04 on the #414 worktree.** Everything this file used to call live is
now rejected. Do not re-report any of it:

    " javascript:…"  "\njavascript:…"  "//evil.com/x.png"  "///evil.com/x.png"
    "/\evil.com/x.png"  "\\evil.com/x.png"  "jav<TAB>ascript:"  "jav<LF>ascript:"
    "../x.png"  "a/./../../b.webp"  bidi U+200E/200F/202A-202E/2066-2069
    C0 + DEL + C1  "portfolio:a/b.webp"  "JAVASCRIPT:alert(1)"  "https:/evil…"

#414 added a control/bidi denylist and normalises `\` to `/` before the
protocol-relative and traversal tests.

**What the fix does not touch, and is the actual exposure.** The absolute-URL
branch is a _scheme_ allowlist with **no host allowlist**:
`https://evil.example/x.png` is accepted, always has been, and produces exactly
the harm #414 opens with — a vendor pointing their public storefront photo at a
host they control. Every backslash trick was a longer way to reach something one
line of plain https already reaches. Two consequences worth carrying:

- The mitigation is the enforced CSP `img-src`, which covers `<img src>` and
  nothing else. `apps/web/src/app/vendors/[slug]/page.tsx` puts the same value
  in **OpenGraph `images`** and **JSON-LD `image`**, which social scrapers and
  crawlers fetch with no CSP. The `url` field three lines above carries a
  comment forbidding exactly this for crawler-followed data.
- Any test named "cannot produce a request to an origin the product did not
  choose" is a fixture check, not a property. The property is false.

**Closed in the same worktree after this audit ran**, so do not re-report these
either: U+061C (ARABIC LETTER MARK) is in the denylist; `a/%2e%2e/%2e%2e/b.webp`
is rejected, because the branch now folds `%2e` back to `.` before it splits;
and `https://cdn.example.com@evil.example/x.png` is rejected, because the
absolute branch refuses credentials in the authority. The **host** itself is
still unconstrained — that is the paragraph above, and it is the one thing here
that is a decision rather than an oversight. Keys stay client-supplied —
[[image-key-columns-are-client-supplied]].

**`avatarUrl`'s provider write path is now guarded too (VEN-538, audited clean).**
The Neon Auth `image` claim is caller-controlled and reaches `users.avatar_url`
by two routes that never see `imageRefSchema` — `createNeonUserLoader` in
`apps/api/src/plugins/neon-auth.ts` (row insert only, via `syncUserFromAuth`)
and `mirroredIdentity`/`applyAuthSyncEvent` in `modules/auth-sync/`. Both now
call `providerAvatarUrl` (`modules/auth-sync/identity.ts`): http(s) only, no
credentials, no C0/DEL/`\`, `<= MAX_URL_LENGTH` (= the column's varchar(500)),
`null` meaning "no opinion" so a refused value never blanks a stored one. It
returns the **raw trimmed string**, not `url.href`, so `https:/evil.com/x` is
accepted by the guard and then read as an object **key** by `isProviderAvatar`
and `resolveImageUrl` (`^https?:\/\//`) — that degrades to a bucket-prefixed
404, never an extra origin, because the browser and `new URL` share one parser.
The host stays unconstrained (paragraph above), and the enforced `img-src` is
`'self' data: blob: <stripe> <storage origin>` — no provider CDN — so an
external avatar does not render at all in production.

**Why:** the file has now been wrong in both directions — first reporting a
fixed bypass as live, then chasing bypasses of a guard that never defended the
stated threat. Measure, then ask what the guard is _for_.

**How to apply:** before reporting anything here, parse the case against
`packages/shared/dist`. Tightening this schema is also a read-path change —
`conversationSummarySchema.otherPartyAvatarUrl` validates a _counterparty's_
stored value on `GET /conversations`, so a row written under a looser version
500s someone else's inbox. See [[response-schemas-are-a-second-write-boundary]]
and [[validate-before-normalize-return-path]].
