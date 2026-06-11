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
	NOTIFICATIONS: "notifications_queue",
} as const;

export const INGEST_JOBS = {
	INDEX: "index",
} as const;

export type IngestJobData = {
	infoHashes: string[];
};

export const ENRICH_JOBS = {
	ENRICH: "enrich",
	REFRESH: "refresh",
} as const;

export const HOUSEKEEPER_JOBS = {
	PURGE_BLACKLISTED: "purge_blacklisted",
	CLEANUP_DB_ORPHANS: "cleanup_db_orphans",
	CLEANUP_UNUSED_ASSETS: "cleanup_unused_assets",
	SYNC_MEILISEARCH: "sync_meilisearch",
	RECOVER_STALLED_JOBS: "recover_stalled_jobs",
	FORCE_REINDEX: "force_reindex",
	EXPORT_SQLITE: "export_sqlite",
} as const;

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
	/** When set, deliver only to this specific channel*/
	channelId?: string;
	/** When set, deliver only to channels owned by this user. */
	userId?: string;
};

export const ingestQueue = new Queue<IngestJobData>(QUEUES.INGEST, {
	connection,
});
export const enrichQueue = new Queue(QUEUES.ENRICH, { connection });
export const housekeeperQueue = new Queue(QUEUES.HOUSEKEEPER, { connection });
export const aiRepairQueue = new Queue(QUEUES.AI_REPAIR, { connection });
export const notificationsQueue = new Queue<NotificationDispatchJobData>(
	QUEUES.NOTIFICATIONS,
	{ connection },
);

export { connection, QueueEvents, Worker };
