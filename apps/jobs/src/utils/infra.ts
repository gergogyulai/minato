import { connection } from "@project-minato/queue";
import { meiliClient, setupTorrentIndex } from "@project-minato/meilisearch";
import { sql } from "drizzle-orm";
import { db } from "@project-minato/db";
import { logger } from "./logger";

export async function checkInfrastructure() {
  try {
    await connection.ping();
    logger.step("Redis", "CONNECTED");

    await meiliClient.health();
    logger.step("MeiliSearch", "CONNECTED");

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