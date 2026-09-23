-- VEN-648: an image column holds an object key, never a host.
--
-- Uploads have stored keys since the web client started sending them, but rows
-- written before that — and any value a client sent as `<STORAGE_PUBLIC_URL>/<key>`
-- — still hold an absolute URL, which ties the row to the host it was uploaded
-- under: a CDN, a custom image domain, a provider move or a prod -> staging copy
-- would each need every such row rewritten. This rewrites them once, here, so
-- the deploy does it rather than a hand-run script.
--
-- The key is recovered from the URL's shape, not from a configured base, since a
-- migration cannot read `STORAGE_PUBLIC_URL`: an upload key is always
-- `<prefix>/<owner>/<name>` and is the tail of the URL whatever the host and
-- bucket path in front of it (`apps/api/src/lib/storage.ts`, `buildObjectKey`).
-- That also covers the legacy R2 hosts `resolveImageUrl` still maps.
--
-- A row is rewritten only when the key's owner segment is the row's own
-- account. Any host can serve a path shaped like someone else's key, so
-- without that check a URL naming another account's object on a foreign host —
-- an auth avatar a caller chose, a row written before #407 — would become a
-- bare key serving that account's photo from our bucket, and a reference its
-- owner's delete could never reap.
--
-- Additive and safe for the release still serving: the columns are unchanged,
-- and that release's reader already resolves a bare key. Values that are not an
-- upload URL — a site-relative seeded path, an auth provider's avatar — do not
-- match and are left exactly as they are. Re-running changes nothing.

UPDATE "vendor_profiles"
SET "profile_image_url" = substring("profile_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "profile_image_url" ~* '^https?://'
  AND split_part(substring("profile_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$'), '/', 2) = "user_id"::text;
--> statement-breakpoint
UPDATE "vendor_profiles"
SET "cover_image_url" = substring("cover_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "cover_image_url" ~* '^https?://'
  AND split_part(substring("cover_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$'), '/', 2) = "user_id"::text;
--> statement-breakpoint
UPDATE "portfolio_items" AS p
SET "image_url" = substring(p."image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
FROM "vendor_profiles" AS v
WHERE v."id" = p."vendor_id"
  AND p."image_url" ~* '^https?://'
  AND split_part(substring(p."image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$'), '/', 2) = v."user_id"::text;
--> statement-breakpoint
UPDATE "portfolio_items" AS p
SET "thumbnail_url" = substring(p."thumbnail_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
FROM "vendor_profiles" AS v
WHERE v."id" = p."vendor_id"
  AND p."thumbnail_url" ~* '^https?://'
  AND split_part(substring(p."thumbnail_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$'), '/', 2) = v."user_id"::text;
--> statement-breakpoint
-- A customer avatar may legitimately be an auth provider's URL, so only this
-- namespace's own uploads are rewritten.
UPDATE "users"
SET "avatar_url" = substring("avatar_url" FROM '/(customer-profile/[^/?#]+/[^/?#]+)$')
WHERE "avatar_url" ~* '^https?://'
  AND split_part(substring("avatar_url" FROM '/(customer-profile/[^/?#]+/[^/?#]+)$'), '/', 2) = "id"::text;
