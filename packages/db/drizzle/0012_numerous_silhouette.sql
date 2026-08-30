DROP INDEX "conversations_customer_vendor_key";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_request_key" ON "conversations" USING btree ("booking_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_customer_vendor_open_key" ON "conversations" USING btree ("customer_id","vendor_id") WHERE "conversations"."booking_request_id" is null;