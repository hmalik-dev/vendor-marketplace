CREATE TABLE "sign_up_roles" (
	"auth_user_id" varchar(255) PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sign_up_roles_role_is_a_sign_up_role" CHECK ("sign_up_roles"."role" IN ('customer', 'vendor'))
);
--> statement-breakpoint
ALTER TABLE "sign_up_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "sign_up_roles" TO "app_api" USING (true) WITH CHECK (true);