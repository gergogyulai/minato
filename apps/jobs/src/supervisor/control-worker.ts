import { CronExpressionParser } from "cron-parser";
import {
	db,
	eq,
	scraperCommands,
	scrapers,
} from "@project-minato/db";
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
	scheduleEnabled,
	spawnManaged,
} from "./supervisor";

const logger = rootLogger.child({ component: "control-worker" });

async function ackCommand(commandId: string | undefined): Promise<void> {
	if (!commandId) return;
	await db
		.update(scraperCommands)
		.set({ status: "acked", ackedAt: new Date() })
		.where(eq(scraperCommands.id, commandId));
}

export function startControlWorker(): Worker<ScraperControlJobData> {
	return new Worker<ScraperControlJobData>(
		QUEUES.SCRAPER_CONTROL,
		async (job) => {
			const { scraperId, commandId } = job.data;
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

			if (job.name === SCRAPER_CONTROL_JOBS.ENABLE) {
				if (!record) {
					logger.warn(`enable: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await scheduleEnabled(scraperId);
				return;
			}

			if (job.name === SCRAPER_CONTROL_JOBS.STOP) {
				if (!record) {
					logger.warn(`stop: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await killManaged(record);
				await ackCommand(commandId);
				return;
			}

			if (job.name === SCRAPER_CONTROL_JOBS.PAUSE) {
				if (!record) {
					logger.warn(`pause: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await killManaged(record);
				// Write nextRunAt for scheduled scrapers so a supervisor restart
				// restores the schedule timer rather than spawning immediately.
				const [dbRow] = await db
					.select({
						lifecycle: scrapers.lifecycle,
						schedule: scrapers.schedule,
						recommendedSchedule: scrapers.recommendedSchedule,
					})
					.from(scrapers)
					.where(eq(scrapers.id, scraperId))
					.limit(1);
				if (dbRow?.lifecycle === "scheduled") {
					const cron = dbRow.schedule ?? dbRow.recommendedSchedule ?? null;
					if (cron) {
						try {
							const next = CronExpressionParser.parse(cron, { tz: "UTC" }).next().toDate();
							await db
								.update(scrapers)
								.set({ nextRunAt: next, updatedAt: new Date() })
								.where(eq(scrapers.id, scraperId));
						} catch {
							// invalid cron — leave nextRunAt as-is
						}
					}
				}
				await ackCommand(commandId);
				return;
			}

			if (job.name === SCRAPER_CONTROL_JOBS.RESUME) {
				if (!record) {
					logger.warn(`resume: scraper ${scraperId} not in registry, skipping`);
					return;
				}
				await scheduleEnabled(scraperId);
				await ackCommand(commandId);
				return;
			}

			logger.warn(`unknown job name: ${job.name}`);
		},
		{ connection, concurrency: 1 },
	);
}
