-- #329 removes the `style` tag group. This is the **data** half and it has to
-- run first: the DDL that follows recreates `tag_category` without `'style'`
-- and casts `tags.category` to the new type, which fails on any row still
-- holding the value being dropped.
--
-- `vendor_tags` before `tags`, even though the foreign key cascades. Relying on
-- the cascade would work here and hide what happened: a vendor's chosen styles
-- are deleted, not migrated, and there is nowhere to migrate them to — no
-- remaining group means "the way you work". Every other tag a vendor picked is
-- untouched, because the delete is scoped through the tag's category rather
-- than run against the join table wholesale.
DELETE FROM "vendor_tags"
 WHERE "tag_id" IN (SELECT "id" FROM "tags" WHERE "category" = 'style');
--> statement-breakpoint
-- Suggestions carry the same enum on their own column, so a pending style
-- suggestion would survive the delete above only to fail the cast below.
DELETE FROM "tag_suggestions" WHERE "category" = 'style';
--> statement-breakpoint
DELETE FROM "tags" WHERE "category" = 'style';
