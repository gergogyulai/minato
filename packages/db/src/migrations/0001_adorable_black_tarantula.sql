ALTER TABLE "torrents" ADD COLUMN "type" text;--> statement-breakpoint
CREATE INDEX "type_idx" ON "torrents" USING btree ("type");