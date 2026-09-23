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
-- Additive and safe for the release still serving: the columns are unchanged,
-- and that release's reader already resolves a bare key. Values that are not an
-- upload URL — a site-relative seeded path, an auth provider's avatar — do not
-- match and are left exactly as they are. Re-running changes nothing.

UPDATE "vendor_profiles"
SET "profile_image_url" = substring("profile_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "profile_image_url" ~* '^https?://'
  AND "profile_image_url" ~ '/(?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+$';
--> statement-breakpoint
UPDATE "vendor_profiles"
SET "cover_image_url" = substring("cover_image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "cover_image_url" ~* '^https?://'
  AND "cover_image_url" ~ '/(?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+$';
--> statement-breakpoint
UPDATE "portfolio_items"
SET "image_url" = substring("image_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "image_url" ~* '^https?://'
  AND "image_url" ~ '/(?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+$';
--> statement-breakpoint
UPDATE "portfolio_items"
SET "thumbnail_url" = substring("thumbnail_url" FROM '/((?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+)$')
WHERE "thumbnail_url" ~* '^https?://'
  AND "thumbnail_url" ~ '/(?:vendor-profile|vendor-cover|portfolio)/[^/?#]+/[^/?#]+$';
--> statement-breakpoint
-- A customer avatar may legitimately be an auth provider's URL, so only this
-- namespace's own uploads are rewritten.
UPDATE "users"
SET "avatar_url" = substring("avatar_url" FROM '/(customer-profile/[^/?#]+/[^/?#]+)$')
WHERE "avatar_url" ~* '^https?://'
  AND "avatar_url" ~ '/customer-profile/[^/?#]+/[^/?#]+$';
