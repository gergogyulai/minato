ALTER TABLE "enrichments" ADD COLUMN "series_details" jsonb;--> statement-breakpoint
ALTER TABLE "enrichments" DROP COLUMN "total_seasons";--> statement-breakpoint
ALTER TABLE "enrichments" DROP COLUMN "total_episodes";