import { env } from "@project-minato/env/jobs";
import { Queue, QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(env.REDIS_URL, {
	tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
	maxRetriesPerRequest: null,
});

export const QUEUES = {
	INGEST: "torrent_ingest",
	ENRICH: "torrent_enrich",
	HOUSEKEEPER: "housekeeper_queue",
	AI_REPAIR: "ai_repair_queue",
	SCRAPER_CONTROL: "scraper_control",
	NOTIFICATIONS: "notifications_queue",
} as const;

export const ENRICH_JOBS = {
	ENRICH: "enrich",
	REFRESH: "refresh",
} as const;

export const HOUSEKEEPER_JOBS = {
	PURGE_BLACKLISTED: "purge_blacklisted",
	CLEANUP_DB_ORPHANS: "cleanup_db_orphans",
	CLEANUP_UNUSED_ASSETS: "cleanup_unused_assets",
	SYNC_MEILISEARCH: "sync_meilisearch",
	REFRESH_STALE_METADATA: "refresh_stale_metadata",
	RECOVER_STALLED_JOBS: "recover_stalled_jobs",
	FORCE_REINDEX: "force_reindex",
	EXPORT_SQLITE: "export_sqlite",
} as const;

export const SCRAPER_CONTROL_JOBS = {
	RUN: "run",
	KILL: "kill",
	RELOAD: "reload",
	ENABLE: "enable",
} as const;

export type ScraperControlJobData = { scraperId: string };

export const NOTIFICATION_JOBS = {
	DISPATCH: "dispatch",
} as const;

export type NotificationEvent =
	| "scraper_completed"
	| "scraper_failed"
	| "scraper_state_changed"
	| "wanted_torrent_found";

export type NotificationDispatchJobData = {
	event: NotificationEvent;
	payload: Record<string, unknown>;
	/** When set, deliver only to this specific channel (used for test sends). */
	channelId?: string;
};

export const ingestQueue = new Queue(QUEUES.INGEST, { connection });
export const enrichQueue = new Queue(QUEUES.ENRICH, { connection });
export const housekeeperQueue = new Queue(QUEUES.HOUSEKEEPER, { connection });
export const aiRepairQueue = new Queue(QUEUES.AI_REPAIR, { connection });
export const scraperControlQueue = new Queue<ScraperControlJobData>(
	QUEUES.SCRAPER_CONTROL,
	{ connection },
);
export const notificationsQueue = new Queue<NotificationDispatchJobData>(
	QUEUES.NOTIFICATIONS,
	{ connection },
);

export { connection, QueueEvents, Worker };
