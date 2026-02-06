ALTER TABLE "torrents" DROP CONSTRAINT "torrents_enrichment_id_enrichments_id_fk";
--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "torrent_info_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_torrent_info_hash_torrents_info_hash_fk" FOREIGN KEY ("torrent_info_hash") REFERENCES "public"."torrents"("info_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrents" DROP COLUMN "enrichment_id";--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_torrent_info_hash_unique" UNIQUE("torrent_info_hash");