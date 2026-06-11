CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scraper_id" text NOT NULL,
	"command" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"issued_by" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"delivered_at" timestamp,
	"finished_at" timestamp
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
	"next_run_at" timestamp,
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
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklisted_torrents" (
	"info_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklisted_trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text[],
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"torrent_info_hash" text NOT NULL,
	"media_type" text,
	"title" text,
	"genres" text[],
	"poster_url" text,
	"backdrop_url" text,
	"overview" text,
	"tagline" text,
	"year" integer,
	"release_date" timestamp,
	"status" text,
	"runtime" integer,
	"tmdb_id" integer,
	"imdb_id" varchar(20),
	"tvdb_id" integer,
	"anilist_id" integer,
	"mal_id" integer,
	"mb_id" varchar(40),
	"discogs_id" integer,
	"spotify_id" varchar(30),
	"music_details" jsonb,
	"provider" text,
	"content_rating" varchar(10),
	"series_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrichments_torrent_info_hash_unique" UNIQUE("torrent_info_hash")
);
--> statement-breakpoint
CREATE TABLE "torrents" (
	"info_hash" text PRIMARY KEY NOT NULL,
	"tracker_title" text NOT NULL,
	"size" bigint NOT NULL,
	"seeders" integer DEFAULT 0,
	"leechers" integer DEFAULT 0,
	"tracker_category" text,
	"standard_category" integer,
	"files" jsonb,
	"magnet" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"type" text,
	"is_dirty" boolean DEFAULT true,
	"release_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"indexed_at" timestamp,
	"enriched_at" timestamp,
	"repaired_at" timestamp
);
--> statement-breakpoint
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
	"group" text,
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_commands" ADD CONSTRAINT "scraper_commands_scraper_id_scrapers_id_fk" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_status" ADD CONSTRAINT "scraper_status_scraper_id_scrapers_id_fk" FOREIGN KEY ("scraper_id") REFERENCES "public"."scrapers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_torrent_info_hash_torrents_info_hash_fk" FOREIGN KEY ("torrent_info_hash") REFERENCES "public"."torrents"("info_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_items" ADD CONSTRAINT "wanted_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_matches" ADD CONSTRAINT "wanted_matches_wanted_item_id_wanted_items_id_fk" FOREIGN KEY ("wanted_item_id") REFERENCES "public"."wanted_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_matches" ADD CONSTRAINT "wanted_matches_torrent_info_hash_torrents_info_hash_fk" FOREIGN KEY ("torrent_info_hash") REFERENCES "public"."torrents"("info_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "notification_channels_user_id_idx" ON "notification_channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scraper_commands_scraper_status_idx" ON "scraper_commands" USING btree ("scraper_id","status");--> statement-breakpoint
CREATE INDEX "scraper_commands_status_expires_idx" ON "scraper_commands" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "tmdb_id_idx" ON "enrichments" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "imdb_id_idx" ON "enrichments" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "tvdb_id_idx" ON "enrichments" USING btree ("tvdb_id");--> statement-breakpoint
CREATE INDEX "anilist_id_idx" ON "enrichments" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "mal_id_idx" ON "enrichments" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX "mb_id_idx" ON "enrichments" USING btree ("mb_id");--> statement-breakpoint
CREATE INDEX "discogs_id_idx" ON "enrichments" USING btree ("discogs_id");--> statement-breakpoint
CREATE INDEX "spotify_id_idx" ON "enrichments" USING btree ("spotify_id");--> statement-breakpoint
CREATE INDEX "info_hash_idx" ON "enrichments" USING btree ("torrent_info_hash");--> statement-breakpoint
CREATE INDEX "is_dirty_partial_idx" ON "torrents" USING btree ("is_dirty") WHERE is_dirty IS TRUE;--> statement-breakpoint
CREATE INDEX "sources_gin_idx" ON "torrents" USING gin ("sources");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "torrents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "type_idx" ON "torrents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wanted_items_user_id_idx" ON "wanted_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wanted_matches_item_id_idx" ON "wanted_matches" USING btree ("wanted_item_id");--> statement-breakpoint
CREATE INDEX "wanted_matches_torrent_idx" ON "wanted_matches" USING btree ("torrent_info_hash");