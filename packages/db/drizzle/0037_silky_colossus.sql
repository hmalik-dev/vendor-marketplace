ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_unpublished';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_republished';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'review_hidden';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'review_unhidden';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'package_deactivated';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'package_reactivated';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'portfolio_item_removed';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'vendor_profile';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'service_package';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'portfolio_item';