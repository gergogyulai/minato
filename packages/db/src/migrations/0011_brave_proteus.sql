DROP INDEX "scraper_commands_scraper_id_created_at_idx";--> statement-breakpoint
DROP INDEX "scraper_commands_status_idx";--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD COLUMN "expires_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
CREATE INDEX "scraper_commands_scraper_status_idx" ON "scraper_commands" USING btree ("scraper_id","status");--> statement-breakpoint
CREATE INDEX "scraper_commands_status_expires_idx" ON "scraper_commands" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "scraper_commands" DROP COLUMN "acked_at";