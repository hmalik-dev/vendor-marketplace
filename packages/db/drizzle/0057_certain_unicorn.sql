ALTER TYPE "public"."operator_alert_kind" ADD VALUE 'refund_unrecorded' BEFORE 'stripe_webhook_failing';--> statement-breakpoint
CREATE TABLE "refund_attempts" (
	"payment_intent_id" text NOT NULL,
	"scope" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_attempts_payment_intent_id_scope_pk" PRIMARY KEY("payment_intent_id","scope")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "external_refund_cents" integer DEFAULT 0 NOT NULL;