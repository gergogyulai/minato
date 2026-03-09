import pc from "picocolors";
import { startIngestWorker } from "@/workers/ingest-worker";
import { startEnrichmentWorker } from "@/workers/enrichment-worker";
import { startHousekeeperWorker } from "@/workers/housekeeper-worker";
import { logger } from "@/utils/logger";
import { connection } from "@project-minato/queue";
import { db, runMigrations } from "@project-minato/db";
import { initConfig, setupConfigSubscriber } from "@project-minato/config";
import { checkInfrastructure } from "@/utils/infra";

const BOOTSTRAP_MAX_RETRIES = 10;
const BOOTSTRAP_INITIAL_DELAY_MS = 3_000;

async function bootstrap(attempt = 1): Promise<void> {
  console.clear();
  console.log(pc.magenta(pc.bold("◢ PROJECT MINATO")));
  logger.info("Initializing worker mesh...");
  console.log("");

  try {
    await checkInfrastructure();

    // try {
    //   await runMigrations();
    // } catch (err) {
    //   throw new Error(`Migration failed: ${err instanceof Error ? err.message : err}`);
    // }

    await initConfig(db);
    setupConfigSubscriber(db);

    logger.step("Config", "LOADED");

    // 3. Start Workers
    const ingestWorker = startIngestWorker();
    const enrichmentWorker = startEnrichmentWorker();
    const housekeeperWorker = startHousekeeperWorker();

    logger.step("Ingest Worker", "ACTIVE");
    logger.step("Enrichment Worker", "ACTIVE");
    logger.step("Housekeeper Worker", "ACTIVE");

    logger.success("System heartbeat stable");
    console.log(pc.dim("Press Ctrl+C to terminate process\n"));

    async function shutdown(signal: string) {
      console.log("");
      logger.warn(`Signal ${pc.bold(signal)} received. Cooling down...`);

      try {
        await Promise.all([
          ingestWorker.close(),
          enrichmentWorker.close(),
          housekeeperWorker.close(),
          connection.quit(),
        ]);

        logger.success("Cleanup complete. Fly safe.");
        process.exit(0);
      } catch (err) {
        logger.error("Error during graceful shutdown");
        process.exit(1);
      }
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    if (attempt <= BOOTSTRAP_MAX_RETRIES) {
      const delay = BOOTSTRAP_INITIAL_DELAY_MS * attempt;
      logger.warn(
        `Bootstrap failed (attempt ${attempt}/${BOOTSTRAP_MAX_RETRIES}) — retrying in ${delay / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delay));
      return bootstrap(attempt + 1);
    }
    logger.error("Bootstrap failed — max retries exhausted");
    console.error(err);
    process.exit(1);
  }
}

bootstrap();