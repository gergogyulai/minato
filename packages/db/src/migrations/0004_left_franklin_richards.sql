ALTER TABLE "enrichments" ADD COLUMN "discogs_id" integer;--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "spotify_id" varchar(30);--> statement-breakpoint
CREATE INDEX "discogs_id_idx" ON "enrichments" USING btree ("discogs_id");--> statement-breakpoint
CREATE INDEX "spotify_id_idx" ON "enrichments" USING btree ("spotify_id");