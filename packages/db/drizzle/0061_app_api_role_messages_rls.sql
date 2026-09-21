DO $$ BEGIN CREATE ROLE "app_api" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$;--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "app_api";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "app_api";--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "app_api";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_api";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT USAGE, SELECT ON SEQUENCES TO "app_api";--> statement-breakpoint
CREATE FUNCTION "public"."app_user_id"() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;--> statement-breakpoint
CREATE FUNCTION "public"."app_role"() RETURNS text LANGUAGE sql STABLE AS $$ select nullif(current_setting('app.role', true), '') $$;--> statement-breakpoint
CREATE FUNCTION "public"."app_is_operator"() RETURNS boolean LANGUAGE sql STABLE AS $$ select coalesce(current_setting('app.operator', true), '') = 'true' and coalesce(current_setting('app.role', true), '') = 'admin' $$;--> statement-breakpoint
CREATE FUNCTION "public"."app_is_conversation_participant"(conversation uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  select exists (
    select 1
      from "public"."conversations" c
      left join "public"."vendor_profiles" v on v."id" = c."vendor_id"
     where c."id" = conversation
       and (c."customer_id" = "public"."app_user_id"() or v."user_id" = "public"."app_user_id"())
  )
$$;--> statement-breakpoint
DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'messages' LOOP EXECUTE format('CREATE POLICY "app_api_unscoped" ON "public".%I TO "app_api" USING (true) WITH CHECK (true)', t); END LOOP; END $$;--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE UPDATE ON "messages" FROM "app_api";--> statement-breakpoint
GRANT UPDATE ("read_at") ON "messages" TO "app_api";--> statement-breakpoint
CREATE POLICY "messages_participant_select" ON "messages" AS PERMISSIVE FOR SELECT TO "app_api" USING ("public"."app_is_conversation_participant"("conversation_id"));--> statement-breakpoint
CREATE POLICY "messages_sender_insert" ON "messages" AS PERMISSIVE FOR INSERT TO "app_api" WITH CHECK ("sender_id" = "public"."app_user_id"() AND "public"."app_is_conversation_participant"("conversation_id"));--> statement-breakpoint
CREATE POLICY "messages_counterparty_update" ON "messages" AS PERMISSIVE FOR UPDATE TO "app_api" USING ("sender_id" <> "public"."app_user_id"() AND "public"."app_is_conversation_participant"("conversation_id")) WITH CHECK ("sender_id" <> "public"."app_user_id"() AND "public"."app_is_conversation_participant"("conversation_id"));--> statement-breakpoint
CREATE POLICY "messages_operator_select" ON "messages" AS PERMISSIVE FOR SELECT TO "app_api" USING ("public"."app_is_operator"());
