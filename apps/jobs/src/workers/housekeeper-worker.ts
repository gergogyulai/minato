import { connection, HOUSEKEEPER_JOBS, QUEUES } from "@project-minato/queue";
import { type Job, Worker } from "bullmq";
import { logger } from "@/utils/logger";
import { cleanupUnusedAssets } from "@/workers/housekeeper/cleanup-unused-assets";
import { exportSqlite } from "@/workers/housekeeper/export-sqlite";
import { performForceReindex } from "@/workers/housekeeper/force-reindex";
import { refreshStaleMetadata } from "@/workers/housekeeper/refresh-stale-metadata";

const log = logger.child({ worker: "housekeeper" });

export function startHousekeeperWorker() {
	return new Worker(
		QUEUES.HOUSEKEEPER,
		async (job: Job) => {
			try {
				switch (job.name) {
					case HOUSEKEEPER_JOBS.CLEANUP_UNUSED_ASSETS:
						return await cleanupUnusedAssets();

					case HOUSEKEEPER_JOBS.REFRESH_STALE_METADATA:
						return await refreshStaleMetadata(job);

					case HOUSEKEEPER_JOBS.FORCE_REINDEX:
						return await performForceReindex(job);

					case HOUSEKEEPER_JOBS.EXPORT_SQLITE:
						return await exportSqlite(job);

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
