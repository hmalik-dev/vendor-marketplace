ALTER TABLE "tags" DROP CONSTRAINT "tags_vendor_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "tag_suggestions" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tag_category";--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('language', 'cultural', 'dietary');--> statement-breakpoint
ALTER TABLE "tag_suggestions" ALTER COLUMN "category" SET DATA TYPE "public"."tag_category" USING "category"::"public"."tag_category";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "category" SET DATA TYPE "public"."tag_category" USING "category"::"public"."tag_category";--> statement-breakpoint
DROP INDEX "tags_scoped_category_name_key";--> statement-breakpoint
DROP INDEX "tags_category_name_key";--> statement-breakpoint
CREATE UNIQUE INDEX "tags_category_name_key" ON "tags" USING btree ("category","name");--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "vendor_category_id";