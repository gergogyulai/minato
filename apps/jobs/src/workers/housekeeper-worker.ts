import { Worker, Job } from 'bullmq';
import { HOUSEKEEPER_JOBS, connection } from '@project-minato/queue';

async function syncMeilisearch(job: Job) {
  console.log('[Housekeeper] Syncing Meilisearch index...');
}

async function cleanupDatabaseOrphans(job: Job) {
  console.log('[Housekeeper] Cleaning up database orphans...');
}

async function cleanupUnusedAssets(job: Job) {
  console.log('[Housekeeper] Cleaning up unused storage assets...');
}

async function recoverStalled(job: Job) {
  console.log('[Housekeeper] Recovering stalled torrents...');
}

async function refreshStaleMetadata(job: Job) {
  console.log('[Housekeeper] Refreshing stale metadata from TMDB...');
}

async function purgeBlacklisted(job: Job) {
  console.log('[Housekeeper] Purging blacklisted content...');
}

async function performForceReindex(job: Job) {
  console.log('[Housekeeper] Performing force reindex of all torrents...');
}

export function startHousekeeperWorker() {
  return new Worker(
    'housekeeper-queue',
    async (job: Job) => {
      try {
        switch (job.name) {
          case HOUSEKEEPER_JOBS.SYNC_MEILISEARCH:
            return await syncMeilisearch(job);

          case HOUSEKEEPER_JOBS.CLEANUP_DB_ORPHANS:
            return await cleanupDatabaseOrphans(job);

          case HOUSEKEEPER_JOBS.CLEANUP_UNUSED_ASSETS:
            return await cleanupUnusedAssets(job);

          case HOUSEKEEPER_JOBS.RECOVER_STALLED_JOBS:
            return await recoverStalled(job);

          case HOUSEKEEPER_JOBS.REFRESH_STALE_METADATA:
            return await refreshStaleMetadata(job);

          case HOUSEKEEPER_JOBS.PURGE_BLACKLISTED:
            return await purgeBlacklisted(job);

          case HOUSEKEEPER_JOBS.FORCE_REINDEX:
            return await performForceReindex(job);

          default:
            console.log(`[Housekeeper] Received unknown job name: ${job.name}`);
            throw new Error(`Unknown job name: ${job.name}`);
        }
      } catch (error) {
        console.error(
          `[Housekeeper] Job failed: ${
            error instanceof Error ? error.message : error
          }`
        );
        throw error;
      } finally {
        console.log(`[Housekeeper] Task ${job.name} finished`);
      }
    },
    {
      connection,
      concurrency: 1,
      maxStalledCount: 1,
    }
  );
}