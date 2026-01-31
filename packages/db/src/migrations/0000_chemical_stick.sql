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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
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
CREATE TABLE "enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" text,
	"genres" text[],
	"poster_url" text,
	"backdrop_url" text,
	"logo_url" text,
	"description" text,
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
	"content_rating" varchar(10),
	"total_seasons" integer,
	"total_episodes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrichments_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "torrents" (
	"info_hash" text PRIMARY KEY NOT NULL,
	"tracker_title" text NOT NULL,
	"size" numeric NOT NULL,
	"seeders" integer DEFAULT 0,
	"leechers" integer DEFAULT 0,
	"tracker_category" text,
	"files" jsonb,
	"magnet" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_dirty" boolean DEFAULT true,
	"type" text,
	"group" text,
	"resolution" text,
	"release_title" text,
	"release_data" jsonb,
	"enrichment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"indexed_at" timestamp,
	"enriched_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrents" ADD CONSTRAINT "torrents_enrichment_id_enrichments_id_fk" FOREIGN KEY ("enrichment_id") REFERENCES "public"."enrichments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "tracker_title_idx" ON "torrents" USING btree ("tracker_title");--> statement-breakpoint
CREATE INDEX "type_idx" ON "torrents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "torrents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sources_gin_idx" ON "torrents" USING gin ("sources");--> statement-breakpoint
CREATE INDEX "dirty_idx" ON "torrents" USING btree ("is_dirty");