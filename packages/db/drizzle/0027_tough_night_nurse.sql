CREATE TABLE "us_cities" (
	"name" varchar(100) NOT NULL,
	"state" "us_state" NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"search_name" text NOT NULL,
	CONSTRAINT "us_cities_name_state_pk" PRIMARY KEY("name","state")
);
--> statement-breakpoint
CREATE INDEX "us_cities_search_name_prefix_idx" ON "us_cities" USING btree ("search_name" text_pattern_ops);