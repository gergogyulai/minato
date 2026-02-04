CREATE TABLE "blacklisted_trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text[],
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
