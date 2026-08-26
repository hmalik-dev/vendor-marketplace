CREATE TYPE "public"."availability_status" AS ENUM('available', 'booked', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."booking_request_status" AS ENUM('pending', 'quoted', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."price_type" AS ENUM('fixed', 'starting_at', 'hourly');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('customer_to_vendor', 'vendor_to_customer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'vendor', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"stripe_customer_id" varchar(255),
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"bio" text,
	"profile_image_url" varchar(500),
	"cover_image_url" varchar(500),
	"address" varchar(500),
	"city" varchar(100),
	"state" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"service_radius_km" integer DEFAULT 50,
	"response_time_hours" integer,
	"stripe_account_id" varchar(255),
	"stripe_onboarded" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"avg_rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_categories" (
	"vendor_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "vendor_categories_vendor_id_category_id_pk" PRIMARY KEY("vendor_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"caption" varchar(500),
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"price_cents" integer NOT NULL,
	"price_type" "price_type" DEFAULT 'fixed' NOT NULL,
	"duration_hours" numeric(4, 1),
	"max_guests" integer,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "availability_status" DEFAULT 'available' NOT NULL,
	"note" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"package_id" uuid,
	"event_date" date NOT NULL,
	"event_type" varchar(200),
	"event_location" varchar(500),
	"guest_count" integer,
	"custom_details" text,
	"status" "booking_request_status" DEFAULT 'pending' NOT NULL,
	"quoted_price_cents" integer,
	"quote_note" text,
	"final_price_cents" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"event_location" varchar(500),
	"total_amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"vendor_payout_cents" integer NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_transfer_id" varchar(255),
	"paid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"booking_request_id" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"type" "review_type" NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_id_booking_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."booking_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_profiles_user_id_key" ON "vendor_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_profiles_slug_key" ON "vendor_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vendor_profiles_published_idx" ON "vendor_profiles" USING btree ("is_published","is_deleted");--> statement-breakpoint
CREATE INDEX "vendor_profiles_city_state_idx" ON "vendor_profiles" USING btree ("city","state") WHERE "vendor_profiles"."is_published" = true AND "vendor_profiles"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vendor_categories_category_id_idx" ON "vendor_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "portfolio_items_vendor_order_idx" ON "portfolio_items" USING btree ("vendor_id","display_order");--> statement-breakpoint
CREATE INDEX "service_packages_vendor_active_idx" ON "service_packages" USING btree ("vendor_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_vendor_date_key" ON "availability" USING btree ("vendor_id","date");--> statement-breakpoint
CREATE INDEX "booking_requests_customer_status_idx" ON "booking_requests" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "booking_requests_vendor_status_idx" ON "booking_requests" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX "booking_requests_expires_at_idx" ON "booking_requests" USING btree ("expires_at") WHERE "booking_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_request_id_key" ON "bookings" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_vendor_idx" ON "bookings" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_customer_vendor_key" ON "conversations" USING btree ("customer_id","vendor_id");--> statement-breakpoint
CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_vendor_idx" ON "conversations" USING btree ("vendor_id","last_message_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_reviewer_key" ON "reviews" USING btree ("booking_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_vendor_public_idx" ON "reviews" USING btree ("vendor_id","created_at") WHERE "reviews"."type" = 'customer_to_vendor';--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at","created_at");