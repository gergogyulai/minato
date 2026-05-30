ALTER TABLE "enrichments" ADD COLUMN "mb_id" varchar(40);--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "music_details" jsonb;--> statement-breakpoint
CREATE INDEX "mb_id_idx" ON "enrichments" USING btree ("mb_id");