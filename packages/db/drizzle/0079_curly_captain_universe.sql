-- allow-destructive: relaxes NOT NULL so the waitlist row can exist from an email alone (VEN-512); nothing is dropped or narrowed, and the release still serving never wrote a null here.
ALTER TABLE "vendor_applications" ALTER COLUMN "business_name" DROP NOT NULL;--> statement-breakpoint
-- allow-destructive: same as above.
ALTER TABLE "vendor_applications" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
-- allow-destructive: same as above.
ALTER TABLE "vendor_applications" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
-- allow-destructive: same as above.
ALTER TABLE "vendor_applications" ALTER COLUMN "message" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD COLUMN "state" "us_state";