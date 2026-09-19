CREATE TABLE "review_tombstones" (
	"booking_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_tombstones_booking_id_reviewer_id_pk" PRIMARY KEY("booking_id","reviewer_id")
);
--> statement-breakpoint
ALTER TABLE "review_tombstones" ADD CONSTRAINT "review_tombstones_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tombstones" ADD CONSTRAINT "review_tombstones_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;