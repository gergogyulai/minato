CREATE INDEX "tmdb_id_idx" ON "enrichments" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "imdb_id_idx" ON "enrichments" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "tvdb_id_idx" ON "enrichments" USING btree ("tvdb_id");--> statement-breakpoint
CREATE INDEX "anilist_id_idx" ON "enrichments" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "mal_id_idx" ON "enrichments" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX "info_hash_idx" ON "enrichments" USING btree ("torrent_info_hash");