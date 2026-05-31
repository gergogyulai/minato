import {
	QUEUES,
	SCRAPER_CONTROL_JOBS,
	type ScraperControlJobData,
	Worker,
	connection,
} from "@project-minato/queue";
import { logger as rootLogger } from "@/utils/logger";
import {
	cancelTimer,
	killManaged,
	managed,
	spawnManaged,
} from "./supervisor";

const logger = rootLogger.child({ component: "control-worker" });

export function startControlWorker(): Worker<ScraperControlJobData> {
	return new Worker<ScraperControlJobData>(
		QUEUES.SCRAPER_CONTROL,
		async (job) => {
			const { scraperId } = job.data;
			const record = managed.get(scraperId);

			if (job.name === SCRAPER_CONTROL_JOBS.RUN) {
				if (!record) {
					logger.warn(`run: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				if (record.proc) {
					logger.info(`run: scraper ${scraperId} already running, skipping`);
					return;
				}
				cancelTimer(scraperId);
				record.restarts = 0;
				await spawnManaged(record);
				return;
			}

			if (job.name === SCRAPER_CONTROL_JOBS.KILL) {
				if (!record) {
					logger.warn(`kill: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await killManaged(record);
				return;
			}

			if (job.name === SCRAPER_CONTROL_JOBS.RELOAD) {
				if (!record) {
					logger.warn(`reload: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await killManaged(record);
				await spawnManaged(record);
				return;
			}

			logger.warn(`unknown job name: ${job.name}`);
		},
		{ connection, concurrency: 1 },
	);
}
