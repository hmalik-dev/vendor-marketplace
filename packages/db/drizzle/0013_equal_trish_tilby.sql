ALTER TABLE "booking_requests" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "stripe_payment_intent_id" varchar(255);