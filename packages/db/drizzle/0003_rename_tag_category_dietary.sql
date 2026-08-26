-- The tag category was renamed from `religious_dietary` to `dietary`: the six
-- religious tags are dropped from the product and the four dietary ones are
-- re-slugged to match the new `TAG_SEEDS` prefix. Without the re-slug the seed
-- would insert a second copy of each surviving tag alongside the old row.
ALTER TYPE "public"."tag_category" RENAME VALUE 'religious_dietary' TO 'dietary';
--> statement-breakpoint
DELETE FROM "tags" WHERE "slug" IN (
  'religious-dietary-muslim',
  'religious-dietary-hindu',
  'religious-dietary-sikh',
  'religious-dietary-buddhist',
  'religious-dietary-christian',
  'religious-dietary-non-denominational'
);
--> statement-breakpoint
UPDATE "tags"
SET "slug" = 'dietary-' || substring("slug" FROM length('religious-dietary-') + 1)
WHERE "slug" LIKE 'religious-dietary-%';
