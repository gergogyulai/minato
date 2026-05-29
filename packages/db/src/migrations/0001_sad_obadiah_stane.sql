CREATE TABLE "scraper_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scraper_id" text NOT NULL,
	"command" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"issued_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"acked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scraper_status" (
	"scraper_id" text PRIMARY KEY NOT NULL,
	"phase" text,
	"progress_current" integer,
	"progress_total" integer,
	"message" text,
	"reported_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrapers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"api_key_id" text NOT NULL,
	"source" jsonb NOT NULL,
	"installed_version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"lifecycle" text,
	"recommended_schedule" text,
	"schedule" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"state" text DEFAULT 'installing' NOT NULL,
	"pid" integer,
	"last_error" text,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	CONSTRAINT "scrapers_api_key_id_unique" UNIQUE("api_key_id")
);
--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD CONSTRAINT "scraper_commands_scraper_id_scrapers_id_fk" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_status" ADD CONSTRAINT "scraper_status_scraper_id_scrapers_id_fk" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scraper_commands_scraper_id_created_at_idx" ON "scraper_commands" USING btree ("scraper_id","created_at");--> statement-breakpoint
CREATE INDEX "scraper_commands_status_idx" ON "scraper_commands" USING btree ("status");