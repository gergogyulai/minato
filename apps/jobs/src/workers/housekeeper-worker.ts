import { Worker, Job } from 'bullmq';
import { HOUSEKEEPER_JOBS, connection } from '@project-minato/queue';
import { syncMeilisearch } from '@/workers/housekeeper/sync-meilisearch';
import { cleanupDatabaseOrphans } from '@/workers/housekeeper/cleanup-db-orphans';
import { cleanupUnusedAssets } from '@/workers/housekeeper/cleanup-unused-assets';
import { refreshStaleMetadata } from '@/workers/housekeeper/refresh-stale-metadata';
import { recoverStalledJobs } from '@/workers/housekeeper/recover-stalled-jobs';
import { purgeBlacklisted } from '@/workers/housekeeper/purge-blacklisted';
import { performForceReindex } from '@/workers/housekeeper/force-reindex';

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
            return await recoverStalledJobs(job);

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