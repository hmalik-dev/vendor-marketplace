-- allow-destructive: each dropped constraint is re-added below in the same migration with ON DELETE restrict
ALTER TABLE "legal_acceptances" DROP CONSTRAINT "legal_acceptances_vendor_id_vendor_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "legal_acceptances" DROP CONSTRAINT "legal_acceptances_accepted_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_actions" DROP CONSTRAINT "admin_actions_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_suggestions_resolved_tag_idx" ON "tag_suggestions" USING btree ("resolved_tag_id");--> statement-breakpoint
CREATE INDEX "platform_settings_updated_by_idx" ON "platform_settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "vendor_invites_invited_by_idx" ON "vendor_invites" USING btree ("invited_by");