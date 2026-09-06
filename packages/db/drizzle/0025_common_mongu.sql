CREATE TYPE "public"."booking_cancelled_by" AS ENUM('customer', 'admin');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" "booking_cancelled_by";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_amount_cents" integer;