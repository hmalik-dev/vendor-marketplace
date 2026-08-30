ALTER TYPE "public"."tag_category" ADD VALUE 'style' BEFORE 'language';--> statement-breakpoint
DROP INDEX "tags_category_name_key";--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "vendor_category_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_vendor_category_id_categories_id_fk" FOREIGN KEY ("vendor_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_scoped_category_name_key" ON "tags" USING btree ("vendor_category_id","name") WHERE "tags"."vendor_category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_category_name_key" ON "tags" USING btree ("category","name") WHERE "tags"."vendor_category_id" IS NULL;