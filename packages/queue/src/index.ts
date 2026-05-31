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
	SCRAPER_CONTROL: "scraper_control",
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
} as const;

export const SCRAPER_CONTROL_JOBS = {
	RUN: "run",
	KILL: "kill",
	RELOAD: "reload",
} as const;

export type ScraperControlJobData = { scraperId: string };

export const ingestQueue = new Queue(QUEUES.INGEST, { connection });
export const enrichQueue = new Queue(QUEUES.ENRICH, { connection });
export const housekeeperQueue = new Queue(QUEUES.HOUSEKEEPER, { connection });
export const scraperControlQueue = new Queue<ScraperControlJobData>(
	QUEUES.SCRAPER_CONTROL,
	{ connection },
);

export { connection, QueueEvents, Worker };
