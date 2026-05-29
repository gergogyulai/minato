import { connection } from "@project-minato/queue";
import { meiliClient, setupTorrentIndex } from "@project-minato/meilisearch";
import { sql } from "drizzle-orm";
import { db } from "@project-minato/db";
import { logger } from "@/utils/logger";

export async function checkInfrastructure() {
  try {
    await connection.ping();
    logger.info("Redis connected");

    await meiliClient.health();
    logger.info("MeiliSearch connected");

    await setupTorrentIndex();
    logger.info("MeiliSearch index initialized");

    await db.execute(sql`SELECT 1`);
    logger.info("Database connected");

    return true;
  } catch (err) {
    logger.error({ err }, "Health check failed");
    throw err;
  }
}
