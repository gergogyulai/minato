import pc from "picocolors";
import { startIngestWorker } from "@/workers/ingest-worker";
import { startEnrichmentWorker } from "@/workers/enrichment-worker";
import { startReindexWorker } from "@/workers/reindex-worker";
import { logger } from "@/utils/logger";
import { connection } from "@project-minato/queue";
import { db } from "@project-minato/db";
import { getConfig, initConfig, setupConfigSubscriber } from "@project-minato/config";
import { checkInfrastructure } from "@/utils/infra";

async function bootstrap() {
  console.clear();
  console.log(pc.magenta(pc.bold("◢ PROJECT MINATO")));
  logger.info("Initializing worker mesh...");
  console.log("");

  try {
    await checkInfrastructure();

    await initConfig(db);
    setupConfigSubscriber(db);

    logger.step("Config", "LOADED");

    // 3. Start Workers
    const ingestWorker = startIngestWorker();
    const enrichmentWorker = startEnrichmentWorker();
    const reindexWorker = startReindexWorker();

    logger.step("Ingest Worker", "ACTIVE");
    logger.step("Enrichment Worker", "ACTIVE");
    logger.step("Reindex Worker", "ACTIVE");

    logger.success("System heartbeat stable");
    console.log(pc.dim("Press Ctrl+C to terminate process\n"));

    async function shutdown(signal: string) {
      console.log("");
      logger.warn(`Signal ${pc.bold(signal)} received. Cooling down...`);

      try {
        await Promise.all([
          ingestWorker.close(),
          enrichmentWorker.close(),
          reindexWorker.close(),
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
    logger.error("Bootstrap failed");
    console.error(err);
    process.exit(1);
  }
}

bootstrap();