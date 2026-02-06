DROP INDEX "tracker_title_idx";--> statement-breakpoint
DROP INDEX "type_idx";--> statement-breakpoint
DROP INDEX "dirty_idx";--> statement-breakpoint
CREATE INDEX "is_dirty_partial_idx" ON "torrents" USING btree ("is_dirty") WHERE is_dirty IS TRUE;