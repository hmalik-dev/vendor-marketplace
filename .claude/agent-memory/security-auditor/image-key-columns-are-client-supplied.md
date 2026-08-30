---
name: image-key-columns-are-client-supplied
description: Every image column (portfolioItems.imageUrl, vendorProfiles.profile/coverImageUrl, users.avatarUrl) holds a raw client-supplied string with no ownership record — any code that acts on one is acting on an attacker-chosen key
metadata:
  type: project
---

`imageRefSchema` (packages/shared/src/schemas/index.ts:86) accepts a bare object
key, a site-relative path or an http(s) URL. The upload route mints the key, but
the **client** chooses what string gets persisted — `POST /vendor/portfolio`
stores `input.imageUrl` verbatim, and `PATCH /vendor/profile` stores
`input.profileImageUrl` / `input.coverImageUrl` verbatim. There is no `uploads`
table and no owner segment inside the key, so nothing anywhere records who
uploaded a given key.

Every other vendor's keys are readable with no auth at all: `GET /vendors/:slug`
returns `portfolio[].imageUrl`, `profileImageUrl` and `coverImageUrl` as raw
keys in `publicVendorProfileSchema`.

**Why:** #311 added `ObjectStorage.remove` and reaped keys straight off the
deleted row, which turned "a column the caller controls" into cross-tenant
object deletion (harvest a victim's key from the public profile, store it on
your own row, delete your row, their photo is gone from the bucket).

**How to apply:** treat any new code that _acts on_ one of these columns —
delete, copy, sign, fetch, move — as taking an attacker-chosen key until an
ownership check exists. Reading and rendering is fine (`resolveImageUrl` is the
boundary, see [[image-ref-scheme-allowlist-is-whitespace-bypassable]]). Also
note `syncCoverFromPortfolio` _copies_ a portfolio item's key into
`vendorProfiles.coverImageUrl`, so the same object is referenced by two rows by
design — any per-row lifecycle action on a key needs a "still referenced?" test
as well as an ownership test.
