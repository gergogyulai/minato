import { initConfig, setupConfigSubscriber } from "@project-minato/config";
import { db, runMigrations } from "@project-minato/db";
import { connection } from "@project-minato/queue";
import { startSupervisor, stopAllScrapers } from "@/supervisor";
import { checkInfrastructure } from "@/utils/infra";
import { logger } from "@/utils/logger";
import { startEnrichmentWorker } from "@/workers/enrichment-worker";
import { startHousekeeperWorker } from "@/workers/housekeeper-worker";
import { startIngestWorker } from "@/workers/ingest-worker";

const BOOTSTRAP_MAX_RETRIES = 10;
const BOOTSTRAP_INITIAL_DELAY_MS = 3_000;

async function bootstrap(attempt = 1): Promise<void> {
	logger.info("Initializing worker mesh...");

	try {
		await checkInfrastructure();

		await runMigrations();
		logger.info("Migrations applied");

		await initConfig(db);
		setupConfigSubscriber(db);
		logger.info("Config loaded");

		const ingestWorker = startIngestWorker();
		const enrichmentWorker = startEnrichmentWorker();
		const housekeeperWorker = startHousekeeperWorker();
		logger.info("Workers active: ingest, enrichment, housekeeper");

		await startSupervisor();
		logger.info("Supervisor active");

		logger.info("System heartbeat stable");

		async function shutdown(signal: string) {
			logger.warn({ signal }, "Signal received. Cooling down...");

			try {
				await stopAllScrapers();
				await Promise.all([
					ingestWorker.close(),
					enrichmentWorker.close(),
					housekeeperWorker.close(),
					connection.quit(),
				]);

				logger.info("Cleanup complete");
				process.exit(0);
			} catch (err) {
				logger.error({ err }, "Error during graceful shutdown");
				process.exit(1);
			}
		}

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
	} catch (err) {
		if (attempt <= BOOTSTRAP_MAX_RETRIES) {
			const delay = BOOTSTRAP_INITIAL_DELAY_MS * attempt;
			logger.warn(
				{ attempt, maxRetries: BOOTSTRAP_MAX_RETRIES, retryInMs: delay },
				"Bootstrap failed — retrying",
			);
			await new Promise((r) => setTimeout(r, delay));
			return bootstrap(attempt + 1);
		}
		logger.error({ err }, "Bootstrap failed — max retries exhausted");
		process.exit(1);
	}
}

bootstrap();
