import { Queue, Worker, QueueEvents } from "bullmq";
import { env } from "@project-minato/env/jobs";
import Redis from "ioredis";

const connection = new Redis(env.REDIS_URL, {
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  INGEST: "torrent_ingest",
  ENRICH: "torrent_enrich",
  HOUSEKEEPER: "housekeeper_queue",
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

export const ingestQueue = new Queue(QUEUES.INGEST, { connection });
export const enrichQueue = new Queue(QUEUES.ENRICH, { connection });
export const housekeeperQueue = new Queue(QUEUES.HOUSEKEEPER, { connection });

export { Worker, QueueEvents, connection };