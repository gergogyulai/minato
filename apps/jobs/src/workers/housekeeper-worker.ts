import { connection, HOUSEKEEPER_JOBS } from "@project-minato/queue";
import { type Job, Worker } from "bullmq";
import { logger } from "@/utils/logger";
import { cleanupDatabaseOrphans } from "@/workers/housekeeper/cleanup-db-orphans";
import { cleanupUnusedAssets } from "@/workers/housekeeper/cleanup-unused-assets";
import { performForceReindex } from "@/workers/housekeeper/force-reindex";
import { purgeBlacklisted } from "@/workers/housekeeper/purge-blacklisted";
import { recoverStalledJobs } from "@/workers/housekeeper/recover-stalled-jobs";
import { refreshStaleMetadata } from "@/workers/housekeeper/refresh-stale-metadata";
import { syncMeilisearch } from "@/workers/housekeeper/sync-meilisearch";

const log = logger.child({ worker: "housekeeper" });

export function startHousekeeperWorker() {
	return new Worker(
		"housekeeper-queue",
		async (job: Job) => {
			try {
				switch (job.name) {
					case HOUSEKEEPER_JOBS.SYNC_MEILISEARCH:
						return await syncMeilisearch(job);

					case HOUSEKEEPER_JOBS.CLEANUP_DB_ORPHANS:
						return await cleanupDatabaseOrphans(job);

					case HOUSEKEEPER_JOBS.CLEANUP_UNUSED_ASSETS:
						return await cleanupUnusedAssets();

					case HOUSEKEEPER_JOBS.RECOVER_STALLED_JOBS:
						return await recoverStalledJobs(job);

					case HOUSEKEEPER_JOBS.REFRESH_STALE_METADATA:
						return await refreshStaleMetadata(job);

					case HOUSEKEEPER_JOBS.PURGE_BLACKLISTED:
						return await purgeBlacklisted(job);

					case HOUSEKEEPER_JOBS.FORCE_REINDEX:
						return await performForceReindex(job);

					default:
						log.warn({ jobName: job.name }, "Unknown job name");
						throw new Error(`Unknown job name: ${job.name}`);
				}
			} catch (err) {
				log.error({ err, jobName: job.name }, "Job failed");
				throw err;
			} finally {
				log.debug({ jobName: job.name }, "Task finished");
			}
		},
		{
			connection,
			concurrency: 1,
			maxStalledCount: 1,
		},
	);
}
