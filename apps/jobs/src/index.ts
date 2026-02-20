import pc from "picocolors";
import { startIngestWorker } from "./workers/ingest-worker";
import { startEnrichmentWorker } from "./workers/enrichment-worker";
import { startReindexWorker } from "./workers/reindex-worker";
import { logger } from "./utils/logger";
import { connection } from "@project-minato/queue";
import { meiliClient, setupTorrentIndex } from "@project-minato/meilisearch";
import { db } from "@project-minato/db";
import { sql } from "drizzle-orm";
import { getConfig, initConfig, setupConfigSubscriber } from "@project-minato/config";

async function checkConnections() {
  try {
    await connection.ping();
    logger.step("Redis", "CONNECTED");

    await meiliClient.health();
    logger.step("MeiliSearch", "CONNECTED");

    // Tip: If setupTorrentIndex logs internally, consider moving it
    // or suppressing its output until this step is reached.
    await setupTorrentIndex();
    logger.step("MeiliSearch Index", "INITIALIZED");

    await db.execute(sql`SELECT 1`);
    logger.step("Database", "CONNECTED");
    console.log("");

    return true;
  } catch (err) {
    logger.error("Health check failed");
    throw err;
  }
}

async function bootstrap() {
  console.clear();
  console.log(pc.magenta(pc.bold("◢ PROJECT MINATO")));
  logger.info("Initializing worker mesh...");
  console.log("");

  try {
    // 1. Validate Infrastructure
    await checkConnections();

    // 2. Load Config
    await initConfig(db);
    setupConfigSubscriber(db);
    logger.step("Config", "LOADED");
    console.log("");

    const config = getConfig();
    console.log(config)

    // 3. Start Workers
    const ingestWorker = startIngestWorker();
    const enrichmentWorker = startEnrichmentWorker();
    const reindexWorker = startReindexWorker();

    console.log("");
    logger.step("Ingest Worker", "PASS_1_ACTIVE");
    logger.step("Enrichment Worker", "PASS_2_ACTIVE");
    logger.step("Reindex Worker", "REINDEX_ACTIVE");

    console.log("");
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