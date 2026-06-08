CREATE TABLE "wanted_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"one_shot" boolean DEFAULT false NOT NULL,
	"media_type" text,
	"tmdb_id" integer,
	"title" text,
	"year" integer,
	"season" integer,
	"episode" integer,
	"season_pack" boolean,
	"resolution" text,
	"required_flags" text[] DEFAULT '{}',
	"excluded_flags" text[] DEFAULT '{}',
	"last_match_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanted_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wanted_item_id" uuid NOT NULL,
	"torrent_info_hash" text NOT NULL,
	"matched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanted_matches_unique" UNIQUE("wanted_item_id","torrent_info_hash")
);
--> statement-breakpoint
ALTER TABLE "wanted_items" ADD CONSTRAINT "wanted_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_matches" ADD CONSTRAINT "wanted_matches_wanted_item_id_wanted_items_id_fk" FOREIGN KEY ("wanted_item_id") REFERENCES "public"."wanted_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_matches" ADD CONSTRAINT "wanted_matches_torrent_info_hash_torrents_info_hash_fk" FOREIGN KEY ("torrent_info_hash") REFERENCES "public"."torrents"("info_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wanted_items_user_id_idx" ON "wanted_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wanted_matches_item_id_idx" ON "wanted_matches" USING btree ("wanted_item_id");--> statement-breakpoint
CREATE INDEX "wanted_matches_torrent_idx" ON "wanted_matches" USING btree ("torrent_info_hash");