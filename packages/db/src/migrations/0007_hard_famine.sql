ALTER TABLE "torrents" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "torrents" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;