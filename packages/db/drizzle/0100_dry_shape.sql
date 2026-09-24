ALTER TABLE "bookings" ADD COLUMN "vendor_owed_recovered_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "debt_netted_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_owed_recovered_cents_range" CHECK ("bookings"."vendor_owed_recovered_cents" >= 0 AND "bookings"."vendor_owed_recovered_cents" <= "bookings"."vendor_owed_cents");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_debt_netted_cents_non_negative" CHECK ("bookings"."debt_netted_cents" >= 0);