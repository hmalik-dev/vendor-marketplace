CREATE INDEX "booking_requests_package_idx" ON "booking_requests" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "review_tombstones_reviewer_idx" ON "review_tombstones" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "support_cases_sender_user_idx" ON "support_cases" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "support_cases_resolved_by_idx" ON "support_cases" USING btree ("resolved_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_typical_guest_count_order" CHECK ("users"."typical_guest_count_min" <= "users"."typical_guest_count_max");--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_price_cents_range" CHECK ("service_packages"."price_cents" >= 2500 AND "service_packages"."price_cents" <= 10000000);